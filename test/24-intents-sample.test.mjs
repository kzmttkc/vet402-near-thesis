import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadNear } from "../lib/sources/near.mjs";
import { NEAR_USDC } from "../lib/sources/relay-census.mjs";
import {
  classifyIntentsCall,
  collectIntentsSample,
  countsFromRows,
  PAYMENT_MAX_RAW,
  readStampedIntentsSample,
  rowIsPayment,
  spanFromRows,
  stampIntentsSample,
  TX_BATCH,
  USDC_TOKEN,
} from "../lib/sources/intents-sample.mjs";

const TOKEN = USDC_TOKEN;

function argsFor(amount, { encoding = "base64", intent = "transfer" } = {}) {
  const message = JSON.stringify({
    intents: [{ intent, receiver_id: "payee.near", tokens: { [TOKEN]: amount } }],
  });
  const body = { signed: [{ payload: { message } }] };
  if (encoding === "object") return body;
  if (encoding === "json") return JSON.stringify(body);
  return Buffer.from(JSON.stringify(body)).toString("base64");
}

function entry({
  hash = "h1",
  receiver = "intents.near",
  method = "execute_intents",
  args = argsFor("25000"),
  statuses = [{ SuccessValue: "" }],
  executor = "intents.near",
} = {}) {
  return {
    transaction: {
      hash,
      receiver_id: receiver,
      actions: [{ FunctionCall: { method_name: method, args } }],
    },
    receipts: statuses.map((status) => ({
      execution_outcome: { outcome: { executor_id: executor, status } },
    })),
  };
}

function listRow(hash, ns = "1794064800000000000") {
  return { transaction_hash: hash, tx_block_timestamp: ns, tx_block_height: 223480000 };
}

test("a successful execute_intents call with a small USDC leg counts once", () => {
  assert.equal(TOKEN, `nep141:${NEAR_USDC}`);
  for (const encoding of ["base64", "json", "object"]) {
    const row = classifyIntentsCall(entry({ args: argsFor(encoding === "object" ? 25000 : "25000", { encoding }) }), listRow("h1"));
    assert.equal(rowIsPayment(row), true, encoding);
  }
  const atMax = classifyIntentsCall(entry({ args: argsFor(String(PAYMENT_MAX_RAW)) }), listRow("h1"));
  assert.equal(rowIsPayment(atMax), true);
  assert.equal(atMax.at, "2026-11-07T15:20:00.000Z");
});

test("failures, zero, a larger leg, another receiver, and a withdrawal do not count", () => {
  const failed = classifyIntentsCall(
    entry({ args: argsFor("975000"), statuses: [{ Failure: {} }] }),
    listRow("h1"),
  );
  assert.equal(failed.intents_status, "failure");
  assert.equal(rowIsPayment(failed), false);
  assert.equal(rowIsPayment(classifyIntentsCall(entry({ args: argsFor("0") }), listRow("h1"))), false);
  assert.equal(rowIsPayment(classifyIntentsCall(entry({ args: argsFor(String(PAYMENT_MAX_RAW + 1)) }), listRow("h1"))), false);
  assert.equal(rowIsPayment(classifyIntentsCall(entry({ receiver: "omft.near" }), listRow("h1"))), false);
  assert.equal(rowIsPayment(classifyIntentsCall(entry({ method: "ft_withdraw", args: argsFor("25000", { intent: "ft_withdraw" }) }), listRow("h1"))), false);
  const mixed = classifyIntentsCall(
    entry({ statuses: [{ SuccessReceiptId: "r" }, { Failure: {} }] }),
    listRow("h1"),
  );
  assert.equal(mixed.intents_status, "failure");
  assert.equal(rowIsPayment(mixed), false);
  const spawned = classifyIntentsCall(entry({ statuses: [{ SuccessReceiptId: "r" }] }), listRow("h1"));
  assert.equal(spawned.intents_status, "success");
  assert.equal(rowIsPayment(spawned), true);
  const outerOnly = classifyIntentsCall(
    entry({ statuses: [{ SuccessReceiptId: "outer" }], executor: "escrow.ai.near" }),
    listRow("h1"),
  );
  assert.equal(outerOnly.intents_status, "absent");
  assert.equal(rowIsPayment(outerOnly), false);
  const signerOuter = {
    transaction: entry().transaction,
    execution_outcome: { outcome: { executor_id: "escrow.ai.near", status: { SuccessReceiptId: "outer" } } },
    receipts: [
      { execution_outcome: { outcome: { executor_id: "intents.near", status: { Failure: {} } } } },
      { execution_outcome: { outcome: { executor_id: "escrow.ai.near", status: { SuccessValue: "" } } } },
    ],
  };
  assert.equal(classifyIntentsCall(signerOuter, listRow("h1")).intents_status, "failure");
  assert.equal(rowIsPayment(classifyIntentsCall(signerOuter, listRow("h1"))), false);
});

test("the stamp rejects a payment_count that the rows do not support", () => {
  const row = classifyIntentsCall(entry(), listRow("h1"));
  const counts = countsFromRows([row]);
  assert.equal(counts.payment_count, 1);
  const doc = {
    sha256: "",
    retrieved_at: "2026-11-07T15:23:00.000Z",
    bound: "neither a lower bound nor an upper bound",
    usdc_token: TOKEN,
    payment_max_raw: PAYMENT_MAX_RAW,
    decimals: 6,
    ...counts,
    ...spanFromRows([row]),
    payment_count: 4,
    rows: [row],
  };
  assert.throws(() => readStampedIntentsSample(stampIntentsSample(doc)), /payment_count 4 != 1/);
  doc.payment_count = 1;
  const text = stampIntentsSample(doc);
  assert.equal(readStampedIntentsSample(text).payment_count, 1);
  assert.equal(readStampedIntentsSample(text).height_min, 223480000);
  assert.throws(() => readStampedIntentsSample(text.replace(row.hash, "other")), /sha256 mismatch/);
  const shifted = readStampedIntentsSample(text);
  shifted.height_min = shifted.height_min + 1;
  assert.throws(() => readStampedIntentsSample(stampIntentsSample(shifted)), /height_min/);
});

test("collect opens hashes in batches of 15 and drops a repeated list hash", async () => {
  const calls = [];
  const hashes = Array.from({ length: TX_BATCH + 1 }, (_, i) => `hash${i}`);
  hashes.push(hashes[0]);
  const post = async (path, body) => {
    calls.push({ path, n: body.tx_hashes?.length ?? body.limit });
    if (path === "/v0/account") {
      return {
        txs_count: 50,
        account_txs: hashes.map((hash, i) => ({
          transaction_hash: hash,
          tx_block_timestamp: String(1794064800000000000n + BigInt(i) * 1_000_000_000n),
          tx_block_height: 1000 + i,
        })),
      };
    }
    assert.ok(body.tx_hashes.length <= TX_BATCH);
    return {
      transactions: body.tx_hashes.map((hash) => entry({ hash, args: argsFor(hash === "hash0" ? "25000" : "0") })).reverse(),
    };
  };
  const doc = await collectIntentsSample(post, { retrievedAt: "2026-11-07T15:23:22.000Z" });
  assert.deepEqual(calls.map((call) => call.n), [30, TX_BATCH, 1]);
  assert.equal(doc.rows.length, TX_BATCH + 1);
  assert.equal(doc.payment_count, 1);
  assert.equal(doc.execute_calls, TX_BATCH + 1);
  assert.equal(doc.sample_rows, TX_BATCH + 1);
  assert.equal(doc.height_min, 1000);
  assert.equal(doc.height_max, 1000 + TX_BATCH);
  assert.equal(doc.from, "2026-11-07T15:20:00.000Z");
  assert.equal(doc.to, "2026-11-07T15:20:15.000Z");
  assert.equal(doc.txs_count_reported, 50);
  const missing = async () => collectIntentsSample(async (path, body) => {
    if (path === "/v0/account") {
      return {
        txs_count: 1,
        account_txs: [listRow("gone")],
      };
    }
    return { transactions: [] };
  });
  await assert.rejects(missing, /missing 1 transaction/);
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the frozen sample is 30 index rows and 1 payment-scale settlement", async () => {
  const text = await readFile(join(ROOT, "data/snapshot/near/intents-payment-sample.json"), "utf8");
  const doc = readStampedIntentsSample(text);
  assert.equal(doc.retrieved_at, "2026-11-07T16:20:07.100Z");
  assert.equal(doc.sample_rows, 30);
  assert.equal(doc.execute_calls, 10);
  assert.equal(doc.payment_count, 1);
  assert.equal(doc.from, "2026-11-07T16:18:44.308Z");
  assert.equal(doc.to, "2026-11-07T16:20:04.418Z");
  assert.equal(doc.height_min, 223490307);
  assert.equal(doc.height_max, 223490446);
  assert.equal(doc.sha256, "9c1dc55c0543a20c9878c79464fdf9cc5d9be5a25d23bebab453ece38b5af154");
  const pay = doc.rows.filter(rowIsPayment);
  assert.equal(pay.length, 1);
  assert.equal(pay[0].hash, "A3ono5Jj6CEkqwQTvquK8eF9sPzxcLsqXXc73kYfo4Yw");
  assert.deepEqual(pay[0].usdc_raw, ["493701"]);
  const loaded = await loadNear(join(ROOT, "data/snapshot/near"));
  assert.equal(loaded.numbers["near.intents.sample_rows"].value, 30);
  assert.equal(loaded.numbers["near.intents.payment_count"].value, 1);
  assert.equal(loaded.near.intents_sample.from, doc.from);
  assert.equal(loaded.near.intents_sample.to, doc.to);
  assert.equal(loaded.near.intents_sample.height_min, 223490307);
  assert.equal(loaded.near.intents_sample.height_max, 223490446);
  const offline = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["online/fetch-intents-sample.mjs", "--offline"], {
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  assert.equal(offline.code, 0, offline.stderr);
  assert.equal(
    offline.stdout,
    "intents sample 30 rows, payment_count 1, blocks 223490307 to 223490446, 2026-11-07T16:18:44.308Z to 2026-11-07T16:20:04.418Z UTC\n",
  );
});
