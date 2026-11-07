import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createReceipt, verifyReceipt } from "../lib/delivery-proof/index.mjs";

const vectors = JSON.parse(await readFile(new URL("../lib/delivery-proof/vectors.json", import.meta.url), "utf8"));

test("frozen vectors: valid receipt, tampered body, reused payment, forged signature", () => {
  for (const item of vectors.cases) {
    const got = verifyReceipt(item.receipt, item.expected);
    assert.equal(got.reason, item.expect, item.id);
    assert.equal(got.ok, item.expect === "ok", item.id);
  }
});

test("a receipt created from the test seed matches the frozen valid vector", () => {
  const valid = vectors.cases.find((item) => item.id === "valid");
  const made = createReceipt({
    seed: vectors.seed_base64url,
    payload: valid.receipt.payload,
  });
  assert.deepEqual(made, valid.receipt);
  assert.equal(
    verifyReceipt(made, {
      publicKey: vectors.signer_public_key,
      nonce: "7",
      txHash: valid.receipt.payload.tx_hash,
      contentSha256: vectors.content_sha256,
    }).reason,
    "ok",
  );
});
