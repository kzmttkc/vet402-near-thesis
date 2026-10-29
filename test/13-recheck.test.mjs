import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { judgeBaseReceipt, judgeSolanaTx, recheckRows, selectSample, TOPIC_TRANSFER, USDC } from "../lib/recheck.mjs";

function sha(text) {
  return createHash("sha256").update(text).digest("hex");
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test("sample is settled Base and Solana txs ordered by sha256(tx_hash)", () => {
  const rows = [
    { status: "settled", network: "eip155:8453", tx_hash: "0xaaa" },
    { status: "settled", network: "eip155:8453", tx_hash: "0xbbb" },
    { status: "settled", network: "eip155:8453", tx_hash: "" },
    { status: "settle_failed", network: "eip155:8453", tx_hash: "0xccc" },
    { status: "settled", network: "eip155:1", tx_hash: "0xddd" },
    { status: "settled", network: "solana:mainnet", tx_hash: "sig-a" },
    { status: "settled", network: "solana:mainnet", tx_hash: "sig-b" },
  ];
  const sample = selectSample(rows, { limit: 1 });
  const baseWinner = sha("0xaaa") < sha("0xbbb") ? "0xaaa" : "0xbbb";
  const solWinner = sha("sig-a") < sha("sig-b") ? "sig-a" : "sig-b";
  assert.deepEqual(sample.base, [baseWinner]);
  assert.deepEqual(sample.solana, [solWinner]);
});

test("receipt rules: Base needs status 1 and a USDC Transfer, Solana needs meta.err null", () => {
  assert.equal(judgeBaseReceipt({
    status: "0x1",
    logs: [{ address: USDC, topics: [TOPIC_TRANSFER] }],
  }), "match");
  assert.equal(judgeBaseReceipt({ status: "0x1", logs: [] }), "mismatch");
  assert.equal(judgeBaseReceipt({ status: "0x0", logs: [{ address: USDC, topics: [TOPIC_TRANSFER] }] }), "mismatch");
  assert.equal(judgeBaseReceipt(null), "mismatch");
  assert.equal(judgeSolanaTx({ meta: { err: null } }), "match");
  assert.equal(judgeSolanaTx({ meta: { err: { InstructionError: [0, "X"] } } }), "mismatch");
  assert.equal(judgeSolanaTx(null), "mismatch");
});

test("fake RPC counts match and not re-checked, and a total refusal is not a match", async () => {
  const rows = [
    { status: "settled", network: "eip155:8453", tx_hash: "0xmatch" },
    { status: "settled", network: "eip155:8453", tx_hash: "0xbad" },
    { status: "settled", network: "eip155:8453", tx_hash: "0xfail" },
    { status: "settled", network: "solana:mainnet", tx_hash: "sig-match" },
    { status: "settled", network: "solana:mainnet", tx_hash: "sig-fail" },
    { status: "settled", network: "eip155:42161", tx_hash: "0xother" },
  ];
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "eth_getTransactionReceipt") {
      const hash = body.params[0];
      if (hash === "0xfail") return jsonResponse({}, 429);
      if (hash === "0xbad") return jsonResponse({ result: { status: "0x0", logs: [] } });
      return jsonResponse({
        result: { status: "0x1", logs: [{ address: USDC, topics: [TOPIC_TRANSFER] }] },
      });
    }
    const sig = body.params[0];
    if (sig === "sig-fail") throw new Error("socket closed");
    return jsonResponse({ result: { meta: { err: null } } });
  };
  const result = await recheckRows(rows, {
    fetchImpl,
    baseRpcs: ["https://base.test"],
    solanaRpc: "https://sol.test",
    retries: 1,
    pauseMs: 0,
    gapMs: 0,
    solanaGapMs: 0,
  });
  assert.deepEqual(
    { checked: result.base.checked, match: result.base.match, mismatch: result.base.mismatch, not_rechecked: result.base.not_rechecked },
    { checked: 2, match: 1, mismatch: 1, not_rechecked: 1 },
  );
  assert.deepEqual(
    { checked: result.solana.checked, match: result.solana.match, mismatch: result.solana.mismatch, not_rechecked: result.solana.not_rechecked },
    { checked: 1, match: 1, mismatch: 0, not_rechecked: 1 },
  );
  assert.equal(result.other, "not re-checked");

  const refused = await recheckRows(rows, {
    fetchImpl: async () => {
      throw new Error("down");
    },
    baseRpcs: ["https://base.test"],
    solanaRpc: "https://sol.test",
    retries: 1,
    pauseMs: 0,
    gapMs: 0,
    solanaGapMs: 0,
  });
  assert.equal(refused.base.checked, 0);
  assert.equal(refused.base.match, 0);
  assert.equal(refused.base.not_rechecked, 3);
  assert.equal(refused.solana.match, 0);
  assert.equal(refused.solana.not_rechecked, 2);
});

test("recheck matches the purchase amount, not just any transfer", async () => {
  const { judgeBaseReceipt, judgeSolanaTx, SOLANA_USDC_MINT, USDC, TOPIC_TRANSFER } = await import("../lib/recheck.mjs");
  const receipt = {
    status: "0x1",
    logs: [{ address: USDC, topics: [TOPIC_TRANSFER], data: "0x" + (10000).toString(16).padStart(64, "0") }],
  };
  assert.equal(judgeBaseReceipt(receipt, "10000"), "match");
  assert.equal(judgeBaseReceipt(receipt, "10001"), "mismatch");
  const tx = (delta) => ({
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 2, mint: SOLANA_USDC_MINT, uiTokenAmount: { amount: "500" } }],
      postTokenBalances: [{ accountIndex: 2, mint: SOLANA_USDC_MINT, uiTokenAmount: { amount: String(500 + delta) } }],
    },
  });
  assert.equal(judgeSolanaTx(tx(1000), "1000"), "match");
  assert.equal(judgeSolanaTx(tx(999), "1000"), "mismatch");
});
