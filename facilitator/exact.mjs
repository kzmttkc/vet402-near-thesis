import { createHash } from "node:crypto";
import { ed25519Sign, ed25519Verify, publicKeyFromSeed } from "../lib/delivery-proof/index.mjs";

// Reference checks for x402 NEAR exact against a NEAR-shaped JSON-RPC.
// The signed delegate is canonical JSON. The scheme's production payload is Borsh,
// and this module never submits to mainnet.

export const EMPTY_CODE_HASH = "11111111111111111111111111111111";
export const MAX_GAS = 300_000_000_000_000n;
export const ESTIMATED_BLOCK_SECONDS = 1;

const DELEGATE_KEYS = ["actions", "max_block_height", "nonce", "public_key", "receiver_id", "sender_id"];
const ACTION_KEYS = ["args", "deposit", "gas", "method_name"];
const ARGS_KEYS = ["amount", "receiver_id"];

function exactKeys(keys, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const got = Object.keys(value);
  if (got.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) return null;
  const out = {};
  for (const key of keys) out[key] = value[key];
  return out;
}

export function canonicalDelegate(delegate) {
  if (!delegate || !Array.isArray(delegate.actions) || delegate.actions.length !== 1) return null;
  const action = delegate.actions[0];
  const args = exactKeys(ARGS_KEYS, action?.args);
  const call = exactKeys(ACTION_KEYS, action ? { ...action, args } : null);
  if (!args || !call) return null;
  return exactKeys(DELEGATE_KEYS, { ...delegate, actions: [call] });
}

export function canonicalDelegateBytes(delegate) {
  const body = canonicalDelegate(delegate);
  return body ? Buffer.from(JSON.stringify(body), "utf8") : null;
}

function decimal(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  return BigInt(value);
}

export function timeoutBlocks(maxTimeoutSeconds) {
  if (!Number.isInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0) return null;
  return Math.max(1, Math.ceil(maxTimeoutSeconds / ESTIMATED_BLOCK_SECONDS));
}

export function createPayment({ seed, delegate, accepted }) {
  const body = canonicalDelegate(delegate);
  const bytes = body && Buffer.from(JSON.stringify(body), "utf8");
  if (!bytes) throw new Error("delegate action is not the exact shape");
  const seedBytes = Buffer.isBuffer(seed) ? seed : Buffer.from(seed, "base64url");
  const publicKey = publicKeyFromSeed(seedBytes);
  if (body.public_key !== publicKey) throw new Error("delegate public_key does not match the seed");
  return {
    x402Version: 2,
    accepted,
    payload: {
      public_key: publicKey,
      signature: ed25519Sign(seedBytes, bytes),
      delegate_action: body,
    },
  };
}

export function settlementKey(delegate) {
  const bytes = canonicalDelegateBytes(delegate);
  return bytes ? createHash("sha256").update(bytes).digest("hex") : null;
}

function invalid(reason) {
  return { isValid: false, invalidReason: reason, payer: null };
}

async function rpc(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "vet402", method, params }),
  });
  if (!res.ok) throw Object.assign(new Error(`rpc HTTP ${res.status}`), { rpcName: "RPC_HTTP" });
  const body = await res.json();
  if (body.error) throw Object.assign(new Error(body.error.message || "rpc error"), { rpcName: body.error.name || "RPC_ERROR" });
  return body.result;
}

function callArgs(accountId) {
  return Buffer.from(JSON.stringify({ account_id: accountId }), "utf8").toString("base64");
}

function parseCallResult(result) {
  const raw = result?.result;
  if (!Array.isArray(raw)) return undefined;
  try {
    return JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch {
    return undefined;
  }
}

async function queryOrNull(rpcUrl, params, missingName) {
  try {
    return await rpc(rpcUrl, "query", params);
  } catch (err) {
    if (err.rpcName === missingName) return null;
    throw err;
  }
}

function sameRequirements(accepted, requirements) {
  if (!accepted || !requirements) return false;
  return (
    accepted.scheme === requirements.scheme &&
    accepted.network === requirements.network &&
    accepted.asset === requirements.asset &&
    accepted.payTo === requirements.payTo &&
    accepted.amount === requirements.amount &&
    accepted.maxTimeoutSeconds === requirements.maxTimeoutSeconds
  );
}

function innerSucceeded(result, asset) {
  const rows = result?.receipts_outcome;
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const outcome = rows[0]?.outcome;
  return outcome?.executor_id === asset && outcome.status != null && Object.hasOwn(outcome.status, "SuccessValue");
}

export async function verifyExact({ paymentPayload, paymentRequirements, rpcUrl, relayerAccount }) {
  try {
    if (!paymentPayload || paymentPayload.x402Version !== 2) return invalid("version_mismatch");
    const accepted = paymentPayload.accepted;
    const requirements = paymentRequirements;
    if (accepted?.scheme !== "exact" || requirements?.scheme !== "exact") return invalid("scheme_mismatch");
    if (typeof requirements?.network !== "string" || !/^near:(mainnet|testnet)$/.test(requirements.network)) {
      return invalid("network_mismatch");
    }
    if (accepted?.network !== requirements.network) return invalid("network_mismatch");
    if (!sameRequirements(accepted, requirements)) return invalid("requirement_mismatch");
    const blocks = timeoutBlocks(requirements.maxTimeoutSeconds);
    if (blocks == null) return invalid("requirement_mismatch");

    const delegate = canonicalDelegate(paymentPayload.payload?.delegate_action);
    const bytes = delegate && Buffer.from(JSON.stringify(delegate), "utf8");
    if (!bytes) return invalid("malformed_delegate");
    if (typeof relayerAccount !== "string" || relayerAccount.length === 0) return invalid("relayer_unconfigured");
    if (relayerAccount === delegate.sender_id) return invalid("relayer_is_payer");

    const nonce = decimal(delegate.nonce);
    const maxHeight = decimal(delegate.max_block_height);
    const gas = decimal(delegate.actions[0].gas);
    const amount = decimal(delegate.actions[0].args.amount);
    if (nonce == null || maxHeight == null || gas == null || amount == null) return invalid("malformed_delegate");
    if (gas <= 0n || gas > MAX_GAS) return invalid("gas_out_of_policy");
    if (delegate.actions[0].method_name !== "ft_transfer") return invalid("not_single_ft_transfer");
    if (delegate.actions[0].deposit !== "1") return invalid("deposit_not_one");
    if (delegate.receiver_id !== requirements.asset) return invalid("asset_mismatch");
    if (delegate.actions[0].args.receiver_id !== requirements.payTo) return invalid("pay_to_mismatch");
    if (delegate.actions[0].args.amount !== requirements.amount) return invalid("amount_mismatch");
    if (paymentPayload.payload.public_key !== delegate.public_key) return invalid("bad_signature");
    if (!ed25519Verify(delegate.public_key, bytes, paymentPayload.payload.signature)) return invalid("bad_signature");

    const block = await rpc(rpcUrl, "block", { finality: "final" });
    const height = block?.header?.height;
    const blockId = block?.header?.hash;
    if (!Number.isInteger(height) || height < 0 || typeof blockId !== "string") return invalid("chain_state_unavailable");
    const remaining = maxHeight - BigInt(height);
    if (remaining <= 0n) return invalid("delegate_action_expired");
    if (remaining > BigInt(blocks)) return invalid("delegate_action_timeout_window_exceeds_maxTimeout");
    if (nonce >= BigInt(height) * 1_000_000n) return invalid("delegate_action_nonce_too_large");

    const pinned = { finality: "final", block_id: blockId };
    const sender = await queryOrNull(rpcUrl, { ...pinned, request_type: "view_account", account_id: delegate.sender_id }, "UNKNOWN_ACCOUNT");
    if (!sender) return invalid("sender_missing");
    const token = await queryOrNull(rpcUrl, { ...pinned, request_type: "view_account", account_id: requirements.asset }, "UNKNOWN_ACCOUNT");
    if (!token || token.code_hash === EMPTY_CODE_HASH) return invalid("token_missing");
    const accessKey = await queryOrNull(
      rpcUrl,
      { ...pinned, request_type: "view_access_key", account_id: delegate.sender_id, public_key: delegate.public_key },
      "UNKNOWN_ACCESS_KEY",
    );
    if (!accessKey) return invalid("unknown_access_key");
    if (accessKey.permission !== "FullAccess") return invalid("access_key_not_full_access");
    const chainNonce = decimal(String(accessKey.nonce));
    if (chainNonce == null) return invalid("chain_state_unavailable");
    if (nonce <= chainNonce) return invalid("delegate_action_nonce_already_used");

    const balanceResult = await rpc(rpcUrl, "query", {
      ...pinned,
      request_type: "call_function",
      account_id: requirements.asset,
      method_name: "ft_balance_of",
      args_base64: callArgs(delegate.sender_id),
    });
    const balance = decimal(parseCallResult(balanceResult));
    if (balance == null) return invalid("chain_state_unavailable");
    if (balance < amount) return invalid("insufficient_balance");
    const storageResult = await rpc(rpcUrl, "query", {
      ...pinned,
      request_type: "call_function",
      account_id: requirements.asset,
      method_name: "storage_balance_of",
      args_base64: callArgs(requirements.payTo),
    });
    const storage = parseCallResult(storageResult);
    if (storage == null || typeof storage !== "object") return invalid("storage_not_registered");
    return { isValid: true, invalidReason: null, payer: delegate.sender_id };
  } catch {
    return invalid("chain_state_unavailable");
  }
}

export async function settleExact({ paymentPayload, paymentRequirements, rpcUrl, relayerAccount, settling, settled }) {
  const network = paymentRequirements?.network ?? "";
  const key = settlementKey(paymentPayload?.payload?.delegate_action);
  if (!key) return { success: false, errorReason: "malformed_delegate", transaction: "", network };
  if (settling.has(key) || settled.has(key)) {
    return { success: false, errorReason: "duplicate_settlement", transaction: "", network };
  }
  const verified = await verifyExact({ paymentPayload, paymentRequirements, rpcUrl, relayerAccount });
  if (!verified.isValid) {
    return { success: false, errorReason: verified.invalidReason, transaction: "", network };
  }
  settling.add(key);
  try {
    const result = await rpc(rpcUrl, "broadcast_tx_commit", {
      signer_id: relayerAccount,
      delegate_action: canonicalDelegate(paymentPayload.payload.delegate_action),
      signature: paymentPayload.payload.signature,
      public_key: paymentPayload.payload.public_key,
    });
    const hash = result?.transaction?.hash;
    if (!innerSucceeded(result, paymentRequirements.asset) || typeof hash !== "string" || hash.length === 0) {
      return { success: false, errorReason: "inner_ft_transfer_failed", transaction: "", network, payer: verified.payer };
    }
    const nonce = paymentPayload.payload.delegate_action.nonce;
    settled.set(key, { transaction: hash, nonce, payer: verified.payer, network });
    return { success: true, transaction: hash, network, payer: verified.payer, nonce };
  } catch (err) {
    return {
      success: false,
      errorReason: err.rpcName || "settlement_failed",
      transaction: "",
      network,
      payer: verified.payer,
    };
  } finally {
    settling.delete(key);
  }
}
