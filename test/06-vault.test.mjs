import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  TOPIC_TRANSFER,
  USDC,
  VAULT_DEFINITION,
  fetchVaultLogs,
  numbersFromVaultResult,
  vaultNumbers,
} from "../lib/sources/vault.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VAULT_TOPIC = `0x${"0".repeat(24)}2cff890f0378a11913b6129b2e97417a2c302680`;
const TO = "0x1111111111111111111111111111111111111111";

function runThesis(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["thesis.mjs", ...args], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function listen(handler) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    try {
      const out = await handler(body);
      const status = out.status ?? 200;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(out.body ?? {}));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function hexWord(value) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function transferLog({ block, index, value }) {
  return {
    address: USDC,
    blockNumber: `0x${block.toString(16)}`,
    transactionHash: `0x${"ab".repeat(31)}${index}`,
    logIndex: `0x${index.toString(16)}`,
    topics: [TOPIC_TRANSFER, VAULT_TOPIC, hexWord(BigInt(TO))],
    data: hexWord(value),
  };
}

test("fake RPC counts USDC out and reads the recipient from topic2", async () => {
  let seenTopic = null;
  const server = await listen(async (body) => {
    const filter = body.params[0];
    seenTopic = filter.topics[1];
    assert.equal(filter.address, USDC);
    assert.equal(filter.topics[0], TOPIC_TRANSFER);
    return {
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: [
          transferLog({ block: 16, index: 2, value: 2_500_000n }),
          transferLog({ block: 16, index: 1, value: 1_500_000n }),
        ],
      },
    };
  });
  try {
    const result = await fetchVaultLogs({
      fromBlock: 0,
      toBlock: 900,
      rpcs: [server.url],
      pauseMs: 0,
    });
    assert.equal(seenTopic, VAULT_TOPIC);
    assert.equal(result.unfetched_windows, 0);
    assert.equal(result.logs[0].logIndex, "1");
    assert.equal(result.logs[0].to, TO);
    assert.equal(result.logs[1].value, "2500000");
    const numbers = vaultNumbers(result.logs, {
      from_block: 0,
      to_block: 900,
      retrieved_at: "2026-10-30T00:00:00Z",
    });
    assert.equal(numbers["vault.usdc_out_30d.count"].value, 2);
    assert.equal(numbers["vault.usdc_out_30d.usd"].value, 4);
    assert.equal(numbers["vault.usdc_out_30d.usd"].definition, VAULT_DEFINITION);
    assert.equal(numbers["vault.usdc_out_30d.usd"].source, "base_vault");
    assert.equal(numbersFromVaultResult(result, { from_block: 0, to_block: 900, retrieved_at: "t" })[
      "vault.usdc_out_30d.count"
    ].value, 2);
  } finally {
    await server.close();
  }
});

test("falls through to the next RPC when the first refuses", async () => {
  const bad = await listen(async () => ({ status: 429, body: { error: "rate" } }));
  const good = await listen(async () => ({
    body: { jsonrpc: "2.0", id: 1, result: [transferLog({ block: 3, index: 0, value: 1_000_000n })] },
  }));
  try {
    const result = await fetchVaultLogs({
      fromBlock: 0,
      toBlock: 900,
      rpcs: [bad.url, good.url],
      pauseMs: 0,
    });
    assert.equal(result.unfetched_windows, 0);
    assert.equal(result.logs.length, 1);
    assert.equal(vaultNumbers(result.logs, { from_block: 0, to_block: 900, retrieved_at: "t" })[
      "vault.usdc_out_30d.usd"
    ].value, 1);
  } finally {
    await bad.close();
    await good.close();
  }
});

test("unfetched_windows > 0 emits no numbers and thesis exits 1", async () => {
  let failHits = 0;
  let okHits = 0;
  const server = await listen(async (body) => {
    const start = Number(BigInt(body.params[0].fromBlock));
    if (start === 900) {
      failHits += 1;
      return { body: { jsonrpc: "2.0", id: 1, error: { code: -32000, message: "refused" } } };
    }
    okHits += 1;
    return { body: { jsonrpc: "2.0", id: 1, result: [] } };
  });
  const dir = await mkdtemp(join(tmpdir(), "vault-gap-"));
  try {
    const result = await fetchVaultLogs({
      fromBlock: 0,
      toBlock: 1800,
      rpcs: [server.url],
      pauseMs: 0,
    });
    assert.equal(result.unfetched_windows, 1);
    assert.equal(result.rounds, 6);
    assert.equal(numbersFromVaultResult(result, { from_block: 0, to_block: 1800, retrieved_at: "t" }), null);

    const run = await runThesis([
      "--fetch-vault",
      "--from-block",
      "0",
      "--to-block",
      "1800",
      "--vault-rpc",
      server.url,
      "--snapshot",
      dir,
    ]);
    assert.equal(run.code, 1, run.stdout);
    assert.match(run.stderr, /unfetched_windows 1/);
    const meta = JSON.parse(await readFile(join(dir, "vault-meta.json"), "utf8"));
    assert.equal(meta.unfetched_windows, 1);
    assert.equal(meta.rounds, 6);
    assert.equal(failHits, 12);
    assert.equal(okHits, 2);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
