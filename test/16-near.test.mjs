import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  binomialUpper,
  classifySampled,
  escrowSummary,
  FILES,
  loadNear,
  NEAR_USDC,
  RELAYER,
  relayerKind,
  transfers30d,
} from "../lib/sources/near.mjs";
import { judgeThreshold, thresholdLine, THRESHOLD } from "../lib/threshold.mjs";
import { main } from "../thesis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEAR_DIR = join(ROOT, "data", "snapshot", "near");

const sha = (text) => createHash("sha256").update(text).digest("hex");

test("the committed line is the next whole number above 1% of the frozen Base count", async () => {
  assert.equal(thresholdLine(2_539_947), 25_400);
  assert.equal(thresholdLine(THRESHOLD.base_count_30d), 25_400);
  assert.equal(thresholdLine(2_500_000), 25_001);
  const thesis = await readFile(join(ROOT, "THESIS.md"), "utf8");
  assert.match(thesis, /N ≥ 25,400/);
  assert.match(thesis, /2,539,947/);
  assert.ok(thesis.includes(THRESHOLD.base_file_sha256));
  const base = await readFile(join(ROOT, THRESHOLD.base_file), "utf8");
  if (sha(base) === THRESHOLD.base_file_sha256) {
    assert.equal(JSON.parse(base).result.data.json.total_transactions, THRESHOLD.base_count_30d);
  }
});

test("a partial count can cross the line but never pass it", () => {
  assert.equal(judgeThreshold({ counted: 25_400, complete: false }), "crossed");
  assert.equal(judgeThreshold({ counted: 25_399, complete: true }), "not_crossed");
  assert.equal(judgeThreshold({ counted: 0, complete: false }), "not_decided");
});

test("relayer receipts split into payments, gas refunds, account setup and funding", () => {
  const row = (predecessor, actions) => ({ predecessor_account_id: predecessor, actions: actions.map(([action, method]) => ({ action, method })) });
  assert.equal(relayerKind(row(RELAYER, [["DELEGATE_ACTION", null], ["FUNCTION_CALL", "ft_transfer"]])), "payment");
  assert.equal(relayerKind(row("system", [["TRANSFER", null]])), "gas_refund");
  assert.equal(relayerKind(row(RELAYER, [["ADD_KEY", null]])), "account_setup");
  assert.equal(relayerKind(row("mike.near", [["CREATE_ACCOUNT", null], ["TRANSFER", null], ["ADD_KEY", null]])), "account_setup");
  assert.equal(relayerKind(row("mike.near", [["TRANSFER", null]])), "funding");
});

test("a sampled receipt counts toward N only when its transaction is a Delegate with one ft_transfer to NEAR USDC", () => {
  const row = {
    receipt_id: "r1",
    transaction_hash: "t1",
    predecessor_account_id: "payer.near",
    actions: [{ action: "FUNCTION_CALL", method: "ft_transfer" }],
    outcome_status: true,
  };
  const delegateTx = {
    t1: { actions: [{ type: "Delegate", sender_id: "payer.near", receiver_id: NEAR_USDC, inner: [{ type: "FunctionCall", method_name: "ft_transfer" }] }] },
  };
  assert.equal(classifySampled(row, { r1: { predecessor_id: "payer.near", signer_id: "relayer.near" } }, delegateTx), "delegate");
  assert.equal(classifySampled(row, { r1: { predecessor_id: "payer.near", signer_id: "payer.near" } }, delegateTx), "direct");
  assert.equal(
    classifySampled(row, { r1: { predecessor_id: "payer.near", signer_id: "user.near" } }, { t1: { actions: [{ type: "FunctionCall", method_name: "swap" }] } }),
    "contract_call",
  );
  const twoInner = { t1: { actions: [{ ...delegateTx.t1.actions[0], inner: [{ type: "FunctionCall", method_name: "ft_transfer" }, { type: "Transfer" }] }] } };
  assert.equal(classifySampled(row, { r1: { predecessor_id: "payer.near", signer_id: "relayer.near" } }, twoInner), "contract_call");
  assert.equal(classifySampled({ ...row, outcome_status: false }, {}, {}), "failed");
  assert.equal(classifySampled(row, {}, {}), "unchecked");
});

test("binomial upper bound matches the closed form for zero hits", () => {
  assert.ok(Math.abs(binomialUpper(0, 100) - (1 - 0.05 ** (1 / 100))) < 1e-9);
  assert.ok(binomialUpper(3, 100) > 0.03);
  assert.equal(binomialUpper(5, 5), 1);
});

test("transfer stats take 30 whole days before the window end", () => {
  const data = [];
  for (let d = 1; d <= 31; d += 1) data.push({ date: `2026-10-${String(d).padStart(2, "0")}`, transfers_count: "10" });
  const got = transfers30d({ data }, "2026-10-31T05:00:00.000Z");
  assert.equal(got.total, 300);
  assert.equal(got.from, "2026-10-01");
  assert.equal(got.to, "2026-10-30");
  assert.throws(() => transfers30d({ data: data.slice(0, 10) }, "2026-10-11T00:00:00Z"), /need 30 days/);
});

test("escrow retries of one intent body count once, under the best outcome", () => {
  const signed = (deadline, nonce) => ({
    payload: { message: JSON.stringify({ deadline, intents: [{ intent: "transfer", receiver_id: "a", tokens: { x: "1" } }], signer_id: "s" }), nonce },
  });
  const fail = { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: insufficient balance or overflow" } } } } };
  const summary = escrowSummary({
    txs: [
      { at: "2026-11-07T00:00:00Z", args: { signed: [signed("d1", "n1")] }, execute: { status: fail, intent_hashes: ["h1"] } },
      { at: "2026-11-07T00:00:04Z", args: { signed: [signed("d2", "n2")] }, execute: { status: fail, intent_hashes: ["h2"] } },
      { at: "2026-11-07T00:00:08Z", args: { signed: [signed("d3", "n3")] }, execute: { status: { SuccessValue: "" }, intent_hashes: ["h3"] } },
    ],
  });
  assert.equal(summary.txs, 3);
  assert.equal(summary.per_tx.insufficient_balance, 2);
  assert.equal(summary.unique_intents, 1);
  assert.equal(summary.unique_intent_hashes, 3);
  assert.equal(summary.per_intent.success, 1);
  assert.equal(summary.per_intent.insufficient_balance, 0);
});

test("the frozen NEAR snapshot passes its sha256 check and gives the relayer figures", async () => {
  const { near, numbers, limits } = await loadNear(NEAR_DIR);
  assert.equal(near.relayer.payment_count, 6);
  assert.equal(near.relayer.payment_usdc_min, 0.001);
  assert.equal(near.relayer.payment_usdc_max, 0.001);
  assert.equal(near.relayer.payment_last_at.slice(0, 10), "2026-07-30");
  assert.deepEqual(near.relayer.payment_receivers, ["count.mike.near"]);
  assert.equal(near.relayer.all_inner_success, true);
  assert.equal(near.spec.pr_number, 1459);
  assert.equal(near.spec.settlement_sentence, true);
  assert.equal(near.delegate.line, 25_400);
  assert.ok(["crossed", "not_decided"].includes(near.delegate.result));
  assert.ok(limits.delegate.length > 0 && limits.escrow.length > 0);
  for (const [id, rec] of Object.entries(numbers)) {
    assert.ok(rec.range && Object.keys(rec.range).length > 0, `${id} range`);
    assert.ok(rec.as_of, `${id} as_of`);
    assert.ok(rec.source, `${id} source`);
  }
});

test("an edited NEAR snapshot file is refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-snap-"));
  try {
    await cp(NEAR_DIR, dir, { recursive: true });
    const file = join(dir, FILES.relayer_payments);
    const text = await readFile(file, "utf8");
    await writeFile(file, text.replace('"amount_raw": "1000"', '"amount_raw": "1000000"'));
    await assert.rejects(loadNear(dir), /sha256 mismatch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--fetch-near cannot run with --offline", async () => {
  await assert.rejects(main(["--fetch-near", "--offline"]), /cannot --fetch-near with --offline/);
});
