import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contentSha256, createReceipt, publicKeyFromSeed } from "../lib/delivery-proof/index.mjs";
import { NEAR_USDC } from "../lib/sources/relay-census.mjs";
import { createPayment } from "../facilitator/exact.mjs";
import { mockChainState, startMockRpc } from "../facilitator/mock-rpc.mjs";
import { startFacilitator } from "../facilitator/server.mjs";

// near-sandbox and nearup are not installed. This file never dials mainnet.
// The chain is facilitator/mock-rpc.mjs on 127.0.0.1.

const BUYER_SEED = Buffer.from("vet402-facilitator-buyer-seed!!!");
const SELLER_SEED = Buffer.from("vet402-facilitator-seller-seed!!");
const BUYER = "buyer.test.local";
const SELLER = "seller.test.local";
const RELAYER = "mock-relayer.local";

function requirements() {
  return {
    scheme: "exact",
    network: "near:mainnet",
    amount: "350000",
    asset: NEAR_USDC,
    payTo: SELLER,
    maxTimeoutSeconds: 60,
  };
}

function delegateFor(nonce, maxBlockHeight = "160") {
  return {
    sender_id: BUYER,
    receiver_id: NEAR_USDC,
    public_key: publicKeyFromSeed(BUYER_SEED),
    nonce,
    max_block_height: maxBlockHeight,
    actions: [
      {
        method_name: "ft_transfer",
        deposit: "1",
        gas: "30000000000000",
        args: { receiver_id: SELLER, amount: "350000" },
      },
    ],
  };
}

async function post(url, path, body) {
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function balanceOf(rpcUrl, account) {
  const block = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "bal", method: "block", params: { finality: "final" } }),
  }).then((res) => res.json());
  const result = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "bal2",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        block_id: block.result.header.hash,
        account_id: NEAR_USDC,
        method_name: "ft_balance_of",
        args_base64: Buffer.from(JSON.stringify({ account_id: account }), "utf8").toString("base64"),
      },
    }),
  }).then((res) => res.json());
  return JSON.parse(Buffer.from(result.result.result).toString("utf8"));
}

test("mock NEAR RPC, not a sandbox: buyer payment, facilitator settle, seller receipt", async () => {
  assert.equal(BUYER_SEED.length, 32);
  assert.equal(SELLER_SEED.length, 32);
  const state = mockChainState({
    buyer: BUYER,
    buyerKey: publicKeyFromSeed(BUYER_SEED),
    buyerBalance: "1000000",
    asset: NEAR_USDC,
    payTo: SELLER,
  });
  const mock = await startMockRpc(state);
  const facilitator = await startFacilitator({ rpcUrl: mock.url, relayerAccount: RELAYER });
  try {
    assert.match(mock.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.match(facilitator.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const supported = await fetch(`${facilitator.url}/supported`).then((res) => res.json());
    assert.deepEqual(supported.kinds, [{ x402Version: 2, scheme: "exact", network: "near:mainnet" }]);
    assert.ok(supported.extensions.includes("delivery-proof"));
    assert.deepEqual(supported.signers["near:mainnet"], [RELAYER]);

    const payment = createPayment({ seed: BUYER_SEED, delegate: delegateFor("2"), accepted: requirements() });
    const verified = await post(facilitator.url, "/verify", { paymentPayload: payment, paymentRequirements: requirements() });
    assert.equal(verified.body.isValid, true);
    assert.equal(verified.body.payer, BUYER);

    const forged = structuredClone(payment);
    const sig = Buffer.from(forged.payload.signature, "base64url");
    sig[0] ^= 0xff;
    forged.payload.signature = sig.toString("base64url");
    const bad = await post(facilitator.url, "/verify", { paymentPayload: forged, paymentRequirements: requirements() });
    assert.equal(bad.body.isValid, false);
    assert.equal(bad.body.invalidReason, "bad_signature");

    const settled = await post(facilitator.url, "/settle", { paymentPayload: payment, paymentRequirements: requirements() });
    assert.equal(settled.body.success, true);
    assert.equal(typeof settled.body.transaction, "string");
    assert.ok(settled.body.transaction.length > 0);
    assert.equal(settled.body.payer, BUYER);
    assert.equal(state.txs.filter((tx) => tx.ok).length, 1);
    assert.equal(await balanceOf(mock.url, BUYER), "650000");

    const again = await post(facilitator.url, "/settle", { paymentPayload: payment, paymentRequirements: requirements() });
    assert.equal(again.body.success, false);
    assert.equal(again.body.errorReason, "duplicate_settlement");
    assert.equal(again.body.transaction, "");
    assert.equal(state.txs.filter((tx) => tx.ok).length, 1);

    const delivered = Buffer.from("the delivered answer");
    const sellerKey = publicKeyFromSeed(SELLER_SEED);
    const receipt = createReceipt({
      seed: SELLER_SEED,
      payload: {
        version: 1,
        scheme: "exact",
        network: "near:mainnet",
        nonce: "2",
        tx_hash: settled.body.transaction,
        content_sha256: contentSha256(delivered),
        hash_alg: "sha256",
      },
    });
    const callsAfterSettle = mock.requests;
    const filed = await post(facilitator.url, "/receipt", {
      transaction: settled.body.transaction,
      nonce: "2",
      content_sha256: contentSha256(delivered),
      seller_public_key: sellerKey,
      receipt,
    });
    assert.equal(filed.body.reason, "match");
    assert.equal(filed.body.recorded, true);

    const tampered = await post(facilitator.url, "/receipt", {
      transaction: settled.body.transaction,
      nonce: "2",
      content_sha256: contentSha256(Buffer.from("other bytes")),
      seller_public_key: sellerKey,
      receipt,
    });
    assert.equal(tampered.body.reason, "content_mismatch");

    const reused = createReceipt({
      seed: SELLER_SEED,
      payload: {
        version: 1,
        scheme: "exact",
        network: "near:mainnet",
        nonce: "9",
        tx_hash: settled.body.transaction,
        content_sha256: contentSha256(delivered),
        hash_alg: "sha256",
      },
    });
    const otherPayment = await post(facilitator.url, "/receipt", {
      transaction: settled.body.transaction,
      nonce: "2",
      content_sha256: contentSha256(delivered),
      seller_public_key: sellerKey,
      receipt: reused,
    });
    assert.equal(otherPayment.body.reason, "payment_mismatch");

    const flipped = structuredClone(receipt);
    const raw = Buffer.from(flipped.signature, "base64url");
    raw[0] ^= 0xff;
    flipped.signature = raw.toString("base64url");
    const forgedReceipt = await post(facilitator.url, "/receipt", {
      transaction: settled.body.transaction,
      nonce: "2",
      content_sha256: contentSha256(delivered),
      seller_public_key: sellerKey,
      receipt: flipped,
    });
    assert.equal(forgedReceipt.body.reason, "bad_signature");

    const silent = await post(facilitator.url, "/receipt", {
      transaction: settled.body.transaction,
      nonce: "2",
      content_sha256: contentSha256(delivered),
    });
    assert.equal(silent.body.reason, "unanswered");
    assert.equal(mock.requests, callsAfterSettle);
    assert.equal(await balanceOf(mock.url, BUYER), "650000");
    assert.equal(state.txs.filter((tx) => tx.ok).length, 1);
  } finally {
    await facilitator.close();
    await mock.close();
  }
});

test("verify rejects an expired delegate before any transaction is submitted", async () => {
  const state = mockChainState({
    buyer: BUYER,
    buyerKey: publicKeyFromSeed(BUYER_SEED),
    buyerBalance: "1000000",
    asset: NEAR_USDC,
    payTo: SELLER,
  });
  const mock = await startMockRpc(state);
  const facilitator = await startFacilitator({ rpcUrl: mock.url, relayerAccount: RELAYER });
  try {
    const payment = createPayment({ seed: BUYER_SEED, delegate: delegateFor("2", "100"), accepted: requirements() });
    const verified = await post(facilitator.url, "/verify", { paymentPayload: payment, paymentRequirements: requirements() });
    assert.equal(verified.body.isValid, false);
    assert.equal(verified.body.invalidReason, "delegate_action_expired");
    assert.equal(state.txs.length, 0);
  } finally {
    await facilitator.close();
    await mock.close();
  }
});

test("the README names what NEAR can run on this machine", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /## What runs on this machine/);
  assert.match(readme, /POST \/receipt/);
  assert.match(readme, /canonical JSON, not the Borsh/);
  assert.match(readme, /node --test test\/22-facilitator\.test\.mjs/);
  assert.match(readme, /mock NEAR RPC, not a sandbox: buyer payment, facilitator settle, seller receipt/);
  assert.match(readme, /spec\/delivery-proof\.md/);
  assert.match(readme, /node --test test\/21-delivery-proof\.test\.mjs/);
  assert.match(readme, /frozen vectors: valid receipt, tampered body, reused payment, forged signature/);
  assert.match(readme, /ℹ fail 0/);
});
