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
export const SAMPLE_DAYS = 30;
export const SAMPLE_CLOCK = "16:20:00.000Z";
export const ROWS_PER_DAY = SAMPLE_LIMIT;

const API =
  "POST https://tx.main.fastnear.com/v0/account with is_receiver true, is_signer false, desc false, from the block at 16:20:00.000Z, limit 30, then POST /v0/transactions in batches of 15. One point per day for 30 days. A day that still fails after retries is unavailable.";

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
  if (Array.isArray(doc.points)) {
    if (doc.days !== doc.points.length) throw new Error("intents sample days do not match the points");
    if (doc.clock_utc !== SAMPLE_CLOCK) throw new Error("intents sample clock is wrong");
    if (doc.rows_per_point !== ROWS_PER_DAY) throw new Error("intents sample rows per point are wrong");
    const unavailable = [];
    let rowSum = 0;
    for (const point of doc.points) {
      if (point?.at !== `${point?.date}T${SAMPLE_CLOCK}`) throw new Error(`intents sample point ${point?.date} is not ${SAMPLE_CLOCK}`);
      if (point.status === "ok") {
        if (point.rows !== ROWS_PER_DAY) throw new Error(`intents sample point ${point.date} has ${point.rows} rows`);
        if (typeof point.first_at !== "string" || point.first_at < point.at) {
          throw new Error(`intents sample point ${point.date} starts before ${point.at}`);
        }
        rowSum += point.rows;
      } else if (point.status === "unavailable") {
        if (point.rows !== 0) throw new Error(`intents sample point ${point.date} kept rows`);
        if (typeof point.reason !== "string" || point.reason === "") throw new Error(`intents sample point ${point.date} has no reason`);
        unavailable.push(point.date);
      } else {
        throw new Error(`intents sample point ${point.date} has a bad status`);
      }
    }
    if (rowSum !== doc.sample_rows) throw new Error(`intents sample rows ${doc.sample_rows} != ${rowSum}`);
    if (JSON.stringify(doc.unavailable) !== JSON.stringify(unavailable)) {
      throw new Error("intents sample unavailable dates do not match the points");
    }
    const label = unavailable.length ? unavailable.join(", ") : "none";
    if (doc.unavailable_label !== label) throw new Error("intents sample unavailable label is wrong");
  }
  return doc;
}

export function intentsPaymentView(doc) {
  const counts = countsFromRows(doc.rows);
  return {
    ...counts,
    ...spanFromRows(doc.rows),
    txs_count_reported: Number.isInteger(doc.txs_count_reported) ? doc.txs_count_reported : null,
    days: Number.isInteger(doc.days) ? doc.days : null,
    unavailable_label: typeof doc.unavailable_label === "string" ? doc.unavailable_label : "none",
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

export function clockAt(dateUtc) {
  return `${dateUtc}T${SAMPLE_CLOCK}`;
}

export function lastCompleteDate(tipIso) {
  const tip = Date.parse(tipIso);
  if (!Number.isFinite(tip)) throw new Error("intents sample tip has no time");
  const day = new Date(tip).toISOString().slice(0, 10);
  let end = Date.parse(clockAt(day));
  if (!(end < tip)) end -= 86_400_000;
  return new Date(end).toISOString().slice(0, 10);
}

export function dailyPoints(endDate, days = SAMPLE_DAYS) {
  const end = Date.parse(clockAt(endDate));
  if (!Number.isFinite(end)) throw new Error(`intents sample date ${endDate} is bad`);
  const points = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const at = new Date(end - i * 86_400_000).toISOString();
    points.push({ date: at.slice(0, 10), at });
  }
  return points;
}

function nsFromMs(ms) {
  return (BigInt(ms) * 1_000_000n).toString();
}

export async function heightAtOrAfter(post, targetNs, { lo, hi }) {
  const target = BigInt(targetNs);
  let guard = 0;
  while (lo + 1 < hi && guard < 40) {
    const mid = Math.floor((lo + hi) / 2);
    const block = await post("/v0/block", { block_id: mid });
    const ts = BigInt(block.block.block_timestamp);
    if (ts < target) lo = mid;
    else hi = mid;
    guard += 1;
  }
  const block = await post("/v0/block", { block_id: hi });
  const ts = BigInt(block.block.block_timestamp);
  if (ts < target) throw new Error(`block ${hi} is still before the point`);
  return { height: block.block.block_height ?? hi, block_timestamp: String(ts) };
}

async function readTip(post) {
  const listed = await post("/v0/blocks", { limit: 1 });
  const block = listed?.blocks?.[0];
  if (!block?.block_height || block.block_timestamp == null) throw new Error("FastNEAR tip block missing");
  return {
    height: block.block_height,
    ns: String(block.block_timestamp),
    at: isoFromNs(BigInt(block.block_timestamp)),
  };
}

export async function openListedRows(post, metas) {
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
  if (missing.length > 0) throw new Error(`intents sample missing ${missing.length} transaction bodies`);
  return metas.map((row) => classifyIntentsCall(bodies.get(row.transaction_hash), row));
}

export async function collectPoint(post, { fromHeight = null, limit = ROWS_PER_DAY } = {}) {
  const body = {
    account_id: INTENTS_ACCOUNT,
    is_receiver: true,
    is_signer: false,
    limit,
    desc: false,
  };
  if (fromHeight != null) body.from_tx_block_height = fromHeight;
  const listed = await post("/v0/account", body);
  const metas = [];
  const seen = new Set();
  for (const row of listed?.account_txs ?? []) {
    const hash = row?.transaction_hash;
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    metas.push(row);
    if (metas.length === limit) break;
  }
  const rows = metas.length === 0 ? [] : await openListedRows(post, metas);
  return {
    rows,
    txs_count_reported: Number.isInteger(listed?.txs_count) ? listed.txs_count : null,
  };
}

async function pointHeight(post, point, tip) {
  const targetNs = nsFromMs(Date.parse(point.at));
  const seconds = Number((BigInt(tip.ns) - BigInt(targetNs)) / 1_000_000_000n);
  let lo = Math.max(1, tip.height - Math.ceil(Math.max(seconds, 1) * 3) - 10_000);
  const hi = tip.height;
  let guard = 0;
  let loBlock = await post("/v0/block", { block_id: lo });
  while (BigInt(loBlock.block.block_timestamp) >= BigInt(targetNs) && lo > 1 && guard < 6) {
    lo = Math.max(1, lo - Math.ceil(Math.max(seconds, 86_400)));
    loBlock = await post("/v0/block", { block_id: lo });
    guard += 1;
  }
  return heightAtOrAfter(post, targetNs, { lo, hi });
}

function pointRecord(point, extra) {
  return { date: point.date, at: point.at, ...extra };
}

function publicPoint(record) {
  const copy = { ...record };
  delete copy.sample;
  return copy;
}

export function assembleIntentsSample({ rows, retrievedAt, points, txs_count_reported = null }) {
  const counts = countsFromRows(rows);
  const unavailable = points.filter((point) => point.status === "unavailable").map((point) => point.date);
  return {
    sha256: "",
    retrieved_at: retrievedAt,
    account: INTENTS_ACCOUNT,
    api: API,
    usdc_token: USDC_TOKEN,
    payment_max_raw: PAYMENT_MAX_RAW,
    decimals: 6,
    bound: "neither a lower bound nor an upper bound",
    txs_count_reported,
    days: points.length,
    clock_utc: SAMPLE_CLOCK,
    rows_per_point: ROWS_PER_DAY,
    points: points.map(publicPoint),
    unavailable,
    unavailable_label: unavailable.length ? unavailable.join(", ") : "none",
    ...counts,
    ...spanFromRows(rows),
    rows,
  };
}

export async function collectIntentsSample(post, { retrievedAt = new Date().toISOString(), days = SAMPLE_DAYS, prior = null, onPoint } = {}) {
  const tip = await readTip(post);
  const plan = dailyPoints(lastCompleteDate(tip.at), days);
  const saved = new Map();
  for (const point of prior?.points ?? []) {
    if (point?.status === "ok" && Array.isArray(point.sample) && point.sample.length === ROWS_PER_DAY) saved.set(point.date, point);
  }
  const records = [];
  const rows = [];
  for (const point of plan) {
    const kept = saved.get(point.date);
    let record = kept ?? null;
    if (!record) {
      try {
        const found = await pointHeight(post, point, tip);
        const got = await collectPoint(post, { fromHeight: found.height });
        if (got.rows.length !== ROWS_PER_DAY) {
          record = pointRecord(point, {
            status: "unavailable",
            reason: `got ${got.rows.length} rows`,
            rows: 0,
            height: found.height,
            sample: [],
          });
        } else if (got.rows[0].at < point.at) {
          record = pointRecord(point, {
            status: "unavailable",
            reason: `rows start at ${got.rows[0].at}, before ${point.at}`,
            rows: 0,
            height: found.height,
            sample: [],
          });
        } else {
          record = pointRecord(point, {
            status: "ok",
            rows: got.rows.length,
            height: found.height,
            first_at: got.rows[0].at,
            last_at: got.rows[got.rows.length - 1].at,
            sample: got.rows,
          });
        }
      } catch (err) {
        record = pointRecord(point, {
          status: "unavailable",
          reason: String(err?.message ?? err),
          rows: 0,
          sample: [],
        });
      }
    }
    records.push(record);
    rows.push(...(record.sample ?? []));
    if (onPoint) await onPoint({ tip, points: records, rows });
  }
  return assembleIntentsSample({ rows, retrievedAt, points: records });
}
