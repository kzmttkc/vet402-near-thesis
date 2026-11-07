import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

// Reference receipt for the NEAR exact delivery-proof extension.
// Ed25519 over the UTF-8 canonical JSON of the payload. No network.

const PAYLOAD_KEYS = ["content_sha256", "hash_alg", "network", "nonce", "scheme", "tx_hash", "version"];
const ED25519_SPKI = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");

export function contentSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalPayloadBytes(payload) {
  const missing = PAYLOAD_KEYS.filter((key) => payload?.[key] == null || payload[key] === "");
  if (missing.length > 0) return null;
  const ordered = {};
  for (const key of PAYLOAD_KEYS) ordered[key] = payload[key];
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

function publicFromRaw(raw) {
  if (raw.length !== 32) return null;
  return createPublicKey({ key: Buffer.concat([ED25519_SPKI, raw]), format: "der", type: "spki" });
}

function privateFromSeed(seed) {
  if (seed.length !== 32) throw new Error("ed25519 seed must be 32 bytes");
  return createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, seed]), format: "der", type: "pkcs8" });
}

export function publicKeyFromSeed(seed) {
  const raw = createPublicKey(privateFromSeed(seed)).export({ format: "jwk" }).x;
  return raw;
}

export function ed25519Sign(seed, bytes) {
  const seedBytes = Buffer.isBuffer(seed) ? seed : Buffer.from(seed, "base64url");
  return sign(null, bytes, privateFromSeed(seedBytes)).toString("base64url");
}

export function ed25519Verify(publicKey, bytes, signature) {
  const keyRaw = decodeKey(publicKey);
  const sigRaw = typeof signature === "string" ? Buffer.from(signature, "base64url") : null;
  if (!keyRaw || !sigRaw || sigRaw.length !== 64) return false;
  const key = publicFromRaw(keyRaw);
  return key ? verify(null, bytes, key, sigRaw) : false;
}

export function createReceipt({ seed, payload }) {
  const seedBytes = Buffer.isBuffer(seed) ? seed : Buffer.from(seed, "base64url");
  const bytes = canonicalPayloadBytes(payload);
  if (!bytes || !payloadShape(payload)) throw new Error("receipt payload is not the delivery-proof shape");
  const signature = ed25519Sign(seedBytes, bytes);
  return {
    payload: Object.fromEntries(PAYLOAD_KEYS.map((key) => [key, payload[key]])),
    signer_public_key: publicKeyFromSeed(seedBytes),
    signature,
  };
}

function payloadShape(payload) {
  return (
    payload.version === 1 &&
    payload.scheme === "exact" &&
    payload.hash_alg === "sha256" &&
    typeof payload.network === "string" &&
    typeof payload.nonce === "string" &&
    typeof payload.tx_hash === "string" &&
    /^[0-9a-f]{64}$/.test(payload.content_sha256)
  );
}

function decodeKey(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  try {
    const raw = Buffer.from(text, "base64url");
    return raw.length === 32 ? raw : null;
  } catch {
    return null;
  }
}

// expected.publicKey is the seller key the buyer already trusts.
// expected.contentSha256 is the hash of the bytes the buyer received.
// expected.nonce and expected.txHash are the payment the buyer is checking.
export function verifyReceipt(receipt, expected = {}) {
  if (!receipt || typeof receipt !== "object" || !payloadShape(receipt.payload ?? {})) {
    return { ok: false, reason: "malformed" };
  }
  const bytes = canonicalPayloadBytes(receipt.payload);
  const keyRaw = decodeKey(expected.publicKey ?? receipt.signer_public_key);
  const sigRaw = typeof receipt.signature === "string" ? Buffer.from(receipt.signature, "base64url") : null;
  if (!bytes || !keyRaw || !sigRaw || sigRaw.length !== 64) return { ok: false, reason: "malformed" };
  if (expected.publicKey && receipt.signer_public_key !== expected.publicKey) {
    return { ok: false, reason: "bad_signature" };
  }
  const publicKey = publicFromRaw(keyRaw);
  const signed = publicKey ? verify(null, bytes, publicKey, sigRaw) : false;
  if (!signed) return { ok: false, reason: "bad_signature" };
  if (expected.nonce != null && receipt.payload.nonce !== expected.nonce) {
    return { ok: false, reason: "payment_mismatch" };
  }
  if (expected.txHash != null && receipt.payload.tx_hash !== expected.txHash) {
    return { ok: false, reason: "payment_mismatch" };
  }
  if (expected.contentSha256 != null && receipt.payload.content_sha256 !== expected.contentSha256) {
    return { ok: false, reason: "content_mismatch" };
  }
  return { ok: true, reason: "ok" };
}
