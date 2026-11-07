import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isoFromNs, NEAR_USDC } from "./relay-census.mjs";

// One keyless FastNEAR sample of recent intents.near index rows.
// Public reads only. The payment count is recomputed from the stored rows.

export const INTENTS_ACCOUNT = "intents.near";
export const INTENTS_SAMPLE_FILE = "intents-payment-sample.json";
export const USDC_TOKEN = `nep141:${NEAR_USDC}`;
export const PAYMENT_MAX_RAW = 5_000_000;
export const SAMPLE_LIMIT = 30;
export const TX_BATCH = 15;

const STATUSES = new Set(["success", "failure", "absent"]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function decodeCallArgs(args) {
  if (args == null) return null;
  if (typeof args === "object") return args;
  if (typeof args !== "string") return null;
  const direct = tryJson(args);
  if (direct && typeof direct === "object") return direct;
  try {
    const parsed = tryJson(Buffer.from(args, "base64").toString("utf8"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return null;
  }
  return null;
}

function rawInteger(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return value;
  return null;
}

// USDC amounts on transfer intents inside an execute_intents signed message.
export function usdcRawFromExecuteArgs(args) {
  const decoded = decodeCallArgs(args);
  const signed = decoded?.signed;
  if (!Array.isArray(signed)) return [];
  const out = [];
  for (const item of signed) {
    const message = item?.payload?.message;
    const parsed = typeof message === "string" ? tryJson(message) : message;
    const intents = parsed?.intents;
    if (!Array.isArray(intents)) continue;
    for (const intent of intents) {
      if (intent?.intent !== "transfer") continue;
      const text = rawInteger(intent?.tokens?.[USDC_TOKEN]);
      if (text != null) out.push(text);
    }
  }
  return out;
}

function statusKind(status) {
  if (!status || typeof status !== "object") return "absent";
  if ("Failure" in status) return "failure";
  if ("SuccessValue" in status || "SuccessReceiptId" in status) return "success";
  return "absent";
}

function intentsStatus(entry) {
  const receipts = (entry?.receipts ?? []).filter(
    (row) => row?.execution_outcome?.outcome?.executor_id === INTENTS_ACCOUNT,
  );
  if (receipts.length === 0) return "absent";
  const kinds = receipts.map((row) => statusKind(row.execution_outcome.outcome.status));
  if (kinds.every((kind) => kind === "success")) return "success";
  return "failure";
}

export function classifyIntentsCall(entry, listRow) {
  const tx = entry?.transaction ?? {};
  const calls = (tx.actions ?? []).map((action) => action?.FunctionCall).filter(Boolean);
  const method = calls.map((call) => call.method_name).filter(Boolean).join("+") || "none";
  const amounts = [];
  for (const call of calls) {
    if (call.method_name !== "execute_intents") continue;
    amounts.push(...usdcRawFromExecuteArgs(call.args));
  }
  const at = isoFromNs(BigInt(listRow.tx_block_timestamp));
  if (!at) throw new Error(`intents sample row ${listRow.transaction_hash} has no timestamp`);
  if (!Number.isInteger(listRow.tx_block_height)) {
    throw new Error(`intents sample row ${listRow.transaction_hash} has no block height`);
  }
  return {
    hash: tx.hash ?? listRow.transaction_hash,
    at,
    height: listRow.tx_block_height,
    receiver_id: typeof tx.receiver_id === "string" ? tx.receiver_id : "",
    method,
    intents_status: intentsStatus(entry),
    usdc_raw: amounts,
  };
}

export function rowIsPayment(row) {
  if (row?.receiver_id !== INTENTS_ACCOUNT) return false;
  if (row?.method !== "execute_intents") return false;
  if (row?.intents_status !== "success") return false;
  return (row.usdc_raw ?? []).some((raw) => {
    if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) return false;
    const amount = BigInt(raw);
    return amount > 0n && amount <= BigInt(PAYMENT_MAX_RAW);
  });
}

export function rowIsExecuteCall(row) {
  return row?.receiver_id === INTENTS_ACCOUNT && row?.method === "execute_intents";
}

export function countsFromRows(rows) {
  return {
    sample_rows: rows.length,
    execute_calls: rows.filter(rowIsExecuteCall).length,
    payment_count: rows.filter(rowIsPayment).length,
  };
}

export function spanFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { from: null, to: null, height_min: null, height_max: null };
  }
  const times = rows.map((row) => row.at).slice().sort();
  const heights = rows.map((row) => row.height);
  return {
    from: times[0],
    to: times[times.length - 1],
    height_min: Math.min(...heights),
    height_max: Math.max(...heights),
  };
}

function assertRow(row) {
  if (typeof row?.hash !== "string" || row.hash === "") throw new Error("intents sample row has no hash");
  if (typeof row.at !== "string" || Number.isNaN(Date.parse(row.at))) throw new Error(`intents sample row ${row.hash} has a bad timestamp`);
  if (!Number.isInteger(row.height)) throw new Error(`intents sample row ${row.hash} has a bad height`);
  if (typeof row.receiver_id !== "string") throw new Error(`intents sample row ${row.hash} has a bad receiver`);
  if (typeof row.method !== "string" || row.method === "") throw new Error(`intents sample row ${row.hash} has a bad method`);
  if (!STATUSES.has(row.intents_status)) throw new Error(`intents sample row ${row.hash} has a bad status`);
  if (!Array.isArray(row.usdc_raw) || row.usdc_raw.some((raw) => typeof raw !== "string" || !/^[0-9]+$/.test(raw))) {
    throw new Error(`intents sample row ${row.hash} has a bad USDC amount`);
  }
}

export function stampIntentsSample(doc) {
  const body = { ...doc, sha256: "" };
  const hashed = `${JSON.stringify(body, null, 2)}\n`;
  body.sha256 = sha256(hashed);
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function readStampedIntentsSample(text) {
  const doc = JSON.parse(text);
  const hash = doc.sha256;
  if (typeof hash !== "string" || hash.length !== 64) throw new Error("intents sample has no sha256");
  const again = `${JSON.stringify({ ...doc, sha256: "" }, null, 2)}\n`;
  const got = sha256(again);
  if (got !== hash) throw new Error(`intents sample sha256 mismatch: got ${got}, want ${hash}`);
  if (!Array.isArray(doc.rows)) throw new Error("intents sample has no rows");
  for (const row of doc.rows) assertRow(row);
  const counts = countsFromRows(doc.rows);
  if (doc.sample_rows !== counts.sample_rows) {
    throw new Error(`intents sample sample_rows ${doc.sample_rows} != ${counts.sample_rows}`);
  }
  if (doc.payment_count !== counts.payment_count) {
    throw new Error(`intents sample payment_count ${doc.payment_count} != ${counts.payment_count}`);
  }
  if (doc.execute_calls !== counts.execute_calls) {
    throw new Error(`intents sample execute_calls ${doc.execute_calls} != ${counts.execute_calls}`);
  }
  const span = spanFromRows(doc.rows);
  for (const key of ["from", "to", "height_min", "height_max"]) {
    if (doc[key] !== span[key]) throw new Error(`intents sample ${key} ${doc[key]} != ${span[key]}`);
  }
  if (doc.usdc_token !== USDC_TOKEN) throw new Error("intents sample USDC token is wrong");
  if (doc.payment_max_raw !== PAYMENT_MAX_RAW) throw new Error("intents sample payment max is wrong");
  if (doc.decimals !== 6) throw new Error("intents sample decimals are wrong");
  if (doc.bound !== "neither a lower bound nor an upper bound") {
    throw new Error("intents sample bound label is wrong");
  }
  return doc;
}

export function intentsPaymentView(doc) {
  const counts = countsFromRows(doc.rows);
  return {
    ...counts,
    ...spanFromRows(doc.rows),
    txs_count_reported: Number.isInteger(doc.txs_count_reported) ? doc.txs_count_reported : null,
    retrieved_at: doc.retrieved_at,
    sha256: doc.sha256,
    bound: doc.bound,
    usdc_token: doc.usdc_token,
    payment_max_raw: doc.payment_max_raw,
    decimals: doc.decimals,
  };
}

export async function loadIntentsPaymentSample(dir) {
  try {
    const text = await readFile(join(dir, INTENTS_SAMPLE_FILE), "utf8");
    return intentsPaymentView(readStampedIntentsSample(text));
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function collectIntentsSample(post, { retrievedAt = new Date().toISOString() } = {}) {
  const listed = await post("/v0/account", {
    account_id: INTENTS_ACCOUNT,
    is_receiver: true,
    is_signer: false,
    limit: SAMPLE_LIMIT,
    desc: true,
  });
  const metas = [];
  const seen = new Set();
  for (const row of listed?.account_txs ?? []) {
    const hash = row?.transaction_hash;
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    metas.push(row);
  }
  const bodies = new Map();
  for (let i = 0; i < metas.length; i += TX_BATCH) {
    const slice = metas.slice(i, i + TX_BATCH);
    const opened = await post("/v0/transactions", { tx_hashes: slice.map((row) => row.transaction_hash) });
    for (const entry of opened?.transactions ?? []) {
      const hash = entry?.transaction?.hash;
      if (hash && !bodies.has(hash)) bodies.set(hash, entry);
    }
  }
  const missing = metas.filter((row) => !bodies.has(row.transaction_hash));
  if (missing.length > 0) {
    throw new Error(`intents sample missing ${missing.length} transaction bodies`);
  }
  const rows = metas.map((row) => classifyIntentsCall(bodies.get(row.transaction_hash), row));
  const counts = countsFromRows(rows);
  return {
    sha256: "",
    retrieved_at: retrievedAt,
    account: INTENTS_ACCOUNT,
    api: "POST https://tx.main.fastnear.com/v0/account with is_receiver true, is_signer false, desc true, limit 30, then POST /v0/transactions in batches of 15",
    usdc_token: USDC_TOKEN,
    payment_max_raw: PAYMENT_MAX_RAW,
    decimals: 6,
    bound: "neither a lower bound nor an upper bound",
    txs_count_reported: Number.isInteger(listed?.txs_count) ? listed.txs_count : null,
    ...counts,
    ...spanFromRows(rows),
    rows,
  };
}
