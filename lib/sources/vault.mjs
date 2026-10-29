import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCsv, stringifyCsv } from "../csv.mjs";
import { USER_AGENT } from "../http.mjs";
import { record } from "../numbers.mjs";

export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const VAULT = "0x2CfF890f0378a11913B6129B2E97417a2c302680";
export const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const VAULT_DEFINITION = "USDC sent out of the NEAR Intents treasury on Base (all purposes)";
export const DEFAULT_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://base.gateway.tenderly.co",
  "https://mainnet.base.org",
];

const CSV_HEADERS = ["block", "txhash", "logIndex", "to", "value"];

export function padTopic(address) {
  const hex = String(address).toLowerCase().replace(/^0x/, "");
  return `0x${hex.padStart(64, "0")}`;
}

function hexQty(value) {
  return `0x${value.toString(16)}`;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function windowStarts(fromBlock, toBlock, windowSize) {
  const starts = [];
  for (let start = fromBlock; start < toBlock; start += windowSize) starts.push(start);
  return starts;
}

function parseLog(log) {
  if (
    log == null ||
    log.transactionHash == null ||
    log.blockNumber == null ||
    log.logIndex == null ||
    !Array.isArray(log.topics) ||
    log.topics.length < 3 ||
    log.data == null
  ) {
    throw new Error("malformed log");
  }
  const topicTo = String(log.topics[2]).toLowerCase().replace(/^0x/, "");
  return {
    block: BigInt(log.blockNumber).toString(10),
    txhash: String(log.transactionHash),
    logIndex: BigInt(log.logIndex).toString(10),
    to: `0x${topicTo.slice(-40)}`,
    value: BigInt(log.data).toString(10),
  };
}

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error).slice(0, 180));
  return body.result;
}

function sortLogs(logs) {
  logs.sort((a, b) => {
    const byBlock = BigInt(a.block) - BigInt(b.block);
    if (byBlock !== 0n) return byBlock < 0n ? -1 : 1;
    const byIndex = BigInt(a.logIndex) - BigInt(b.logIndex);
    if (byIndex !== 0n) return byIndex < 0n ? -1 : 1;
    if (a.txhash < b.txhash) return -1;
    if (a.txhash > b.txhash) return 1;
    return 0;
  });
  return logs;
}

// Windows of 900 blocks: start runs over range(from, to, 900), toBlock is min(start + 899, to).
export async function fetchVaultLogs({
  fromBlock,
  toBlock,
  rpcs = DEFAULT_RPCS,
  usdc = USDC,
  vault = VAULT,
  windowSize = 900,
  maxRounds = 6,
  pauseMs = 0,
}) {
  const starts = windowStarts(fromBlock, toBlock, windowSize);
  let pending = starts.slice();
  const logs = [];
  let rounds = 0;
  while (pending.length > 0 && rounds < maxRounds) {
    rounds += 1;
    const failed = [];
    for (const start of pending) {
      const filter = {
        fromBlock: hexQty(start),
        toBlock: hexQty(Math.min(start + windowSize - 1, toBlock)),
        address: usdc,
        topics: [TOPIC_TRANSFER, padTopic(vault)],
      };
      let got = null;
      for (const rpc of rpcs) {
        try {
          const result = await rpcCall(rpc, "eth_getLogs", [filter]);
          if (!Array.isArray(result)) throw new Error("logs not array");
          got = result;
          break;
        } catch {
          await sleep(pauseMs);
        }
      }
      if (got == null) {
        failed.push(start);
        continue;
      }
      try {
        for (const log of got) logs.push(parseLog(log));
      } catch {
        failed.push(start);
      }
      if (pauseMs) await sleep(pauseMs);
    }
    pending = failed;
    if (pending.length > 0 && rounds < maxRounds) await sleep(pauseMs);
  }
  return {
    logs: sortLogs(logs),
    unfetched_windows: pending.length,
    windows: starts.length,
    rounds,
  };
}

export function vaultNumbers(rows, { from_block, to_block, retrieved_at }) {
  let sum = 0n;
  let count = 0;
  for (const row of rows) {
    if (row.value == null || row.value === "") continue;
    count += 1;
    sum += BigInt(row.value);
  }
  const range = { from_block, to_block };
  const source = "base_vault";
  return {
    "vault.usdc_out_30d.count": record("vault.usdc_out_30d.count", {
      value: count,
      unit: "transfers",
      range,
      as_of: retrieved_at,
      source,
      definition: VAULT_DEFINITION,
    }),
    "vault.usdc_out_30d.usd": record("vault.usdc_out_30d.usd", {
      value: Number(sum) / 1e6,
      unit: "USD",
      range,
      as_of: retrieved_at,
      source,
      definition: VAULT_DEFINITION,
    }),
  };
}

export function numbersFromVaultResult(result, meta) {
  if (result.unfetched_windows !== 0) return null;
  return vaultNumbers(result.logs, meta);
}

export async function writeVault(snapshotPath, result, meta) {
  await mkdir(snapshotPath, { recursive: true });
  await writeFile(join(snapshotPath, "vault-transfers.csv"), stringifyCsv(CSV_HEADERS, result.logs));
  await writeFile(
    join(snapshotPath, "vault-meta.json"),
    `${JSON.stringify(
      {
        unfetched_windows: result.unfetched_windows,
        windows: result.windows,
        rounds: result.rounds,
        from_block: meta.from_block,
        to_block: meta.to_block,
        retrieved_at: meta.retrieved_at,
      },
      null,
      2,
    )}\n`,
  );
}

export async function loadVaultNumbers(snapshotPath) {
  const metaPath = join(snapshotPath, "vault-meta.json");
  const csvPath = join(snapshotPath, "vault-transfers.csv");
  let metaText;
  let csvText;
  try {
    metaText = await readFile(metaPath, "utf8");
    csvText = await readFile(csvPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  const meta = JSON.parse(metaText);
  if (meta.unfetched_windows !== 0) {
    throw new Error(`unfetched_windows ${meta.unfetched_windows}`);
  }
  const { rows } = parseCsv(csvText);
  return vaultNumbers(rows, meta);
}
