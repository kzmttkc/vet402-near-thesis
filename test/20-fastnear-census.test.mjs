import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { NEAR_USDC } from "../lib/sources/relay-census.mjs";
import {
  classifyBatch,
  classifyFastnearTx,
  countSignerTxs,
  judgeKnownRelays,
  readStampedFacilitators,
  stampFacilitators,
} from "../lib/sources/fastnear-census.mjs";

const SIGNER = "5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c";

function entry({
  method = "ft_transfer",
  status = { SuccessValue: "" },
  signer = SIGNER,
  delegates = 1,
  usdcReceipts = 1,
} = {}) {
  const actions = [];
  for (let i = 0; i < delegates; i += 1) {
    actions.push({
      Delegate: {
        delegate_action: {
          sender_id: "payer.near",
          receiver_id: NEAR_USDC,
          actions: [{ FunctionCall: { method_name: method, deposit: "1" } }],
        },
      },
    });
  }
  const receipts = [];
  for (let i = 0; i < usdcReceipts; i += 1) {
    receipts.push({
      execution_outcome: { outcome: { executor_id: NEAR_USDC, status } },
    });
  }
  return {
    transaction: { signer_id: signer, receiver_id: "payer.near", actions },
    execution_outcome: { outcome: { executor_id: signer, status: { SuccessReceiptId: "outer" } } },
    receipts,
  };
}

test("a delegate USDC ft_transfer signed by the relayer counts", () => {
  assert.deepEqual(classifyFastnearTx(entry(), SIGNER), { ok: true, reason: "counted" });
});

test("storage calls, a second action, a failed receipt, and another signer do not count", () => {
  assert.equal(classifyFastnearTx(entry({ method: "storage_deposit" }), SIGNER).reason, "not_single");
  assert.equal(classifyFastnearTx(entry({ delegates: 2 }), SIGNER).reason, "not_single");
  assert.equal(classifyFastnearTx(entry({ usdcReceipts: 2 }), SIGNER).reason, "not_single");
  assert.equal(classifyFastnearTx(entry({ status: { Failure: {} } }), SIGNER).reason, "inner_failed");
  assert.equal(classifyFastnearTx(entry({ signer: "other.near" }), SIGNER).reason, "no_usdc_ft");
  assert.equal(classifyFastnearTx(entry({ delegates: 0, usdcReceipts: 0 }), SIGNER).reason, "no_usdc_ft");
});

test("a reversed batch counts the hash whose body matched", () => {
  const hit = entry();
  hit.transaction.hash = "hit";
  const miss = entry({ method: "storage_deposit" });
  miss.transaction.hash = "miss";
  const slice = [
    { hash: "hit", at: "2026-11-01T00:00:00.000Z", height: 2 },
    { hash: "miss", at: "2026-11-01T00:00:01.000Z", height: 3 },
  ];
  const got = classifyBatch(slice, [miss, hit], SIGNER);
  assert.deepEqual(
    got.counted.map((row) => row.hash),
    ["hit"],
  );
  assert.equal(got.rejected.not_single, 1);
  assert.equal(got.rejected.unchecked, 0);
  const missing = classifyBatch([{ hash: "absent", at: null, height: null }], [hit], SIGNER);
  assert.equal(missing.rejected.unchecked, 1);
  assert.equal(missing.counted.length, 0);
});

test("shuffling the response order does not change the count", async () => {
  const rows = [];
  const bodies = [];
  for (let i = 0; i < 6; i += 1) {
    const body = entry(i % 2 === 0 ? {} : { method: "storage_deposit" });
    const hash = `h${i}`;
    body.transaction.hash = hash;
    rows.push({ hash, at: `2026-11-01T00:00:0${i}.000Z`, height: 10 + i });
    bodies.push(body);
  }
  const byHash = new Map(bodies.map((body) => [body.transaction.hash, body]));
  async function run(permute) {
    let calls = 0;
    const post = async (_path, body) => {
      calls += 1;
      const hashes = permute(body.tx_hashes);
      return { transactions: hashes.map((hash) => byHash.get(hash)) };
    };
    const got = await countSignerTxs(post, SIGNER, { rows });
    assert.equal(calls, 1);
    return got;
  }
  const straight = await run((hashes) => hashes);
  const shuffled = await run((hashes) => [hashes[4], hashes[1], hashes[5], hashes[0], hashes[2], hashes[3]]);
  assert.equal(shuffled.counted.length, straight.counted.length);
  assert.equal(straight.counted.length, 3);
  assert.deepEqual(
    shuffled.counted.map((row) => row.hash),
    straight.counted.map((row) => row.hash),
  );
});

test("a known-relay sum below the line is not decided, and a sum on the line is crossed", () => {
  assert.equal(judgeKnownRelays({ lower: 7412, line: 25_400 }), "not_decided");
  assert.equal(judgeKnownRelays({ lower: 25_400, line: 25_400 }), "crossed");
});

test("the frozen facilitator file sums the known accounts and stays under the line", async () => {
  const text = await readFile(new URL("../data/snapshot/near/facilitators.json", import.meta.url), "utf8");
  const doc = readStampedFacilitators(text);
  assert.equal(doc.line, 25_400);
  assert.equal(doc.lower, 1716);
  assert.equal(doc.result, "not_decided");
  assert.equal(doc.list_complete, true);
  const sample = doc.accounts.find((account) => account.account.startsWith("5a95b79b"));
  assert.equal(sample.delegate_usdc, 1716);
  assert.equal(sample.includes_frozen_hit, true);
  assert.equal(sample.sample_hashes[0], "76hZkqNNi359kH266MTbce7ko9nvcqwMaWjtw92Azc4b");
});

test("the sha256 covers the document with the hash field emptied", () => {
  const text = stampFacilitators({
    sha256: "",
    line: 25_400,
    lower: 3,
    result: "not_decided",
    accounts: [
      { account: "a.near", delegate_usdc: 1 },
      { account: "b.near", delegate_usdc: 2 },
    ],
  });
  const doc = readStampedFacilitators(text);
  assert.equal(doc.lower, 3);
  assert.equal(doc.sha256.length, 64);
  const tampered = text.replace('"lower": 3', '"lower": 4');
  assert.throws(() => readStampedFacilitators(tampered), /sha256|lower/);
});
