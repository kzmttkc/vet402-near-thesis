import { readFile, writeFile } from "node:fs/promises";
import { USER_AGENT } from "../http.mjs";
import { thresholdLine } from "../threshold.mjs";

// Census of delegate-action USDC ft_transfers signed by relayer accounts.
// The v1 account txn count is an all-time receipt total and rejects a date filter,
// so this module never treats that count as N.
//
// A frozen archival `tx` has one Delegate action. The inner ft_transfer is not a
// sibling on that transaction. NearBlocks receipt rows for x402-relayer2.mike.near
// do list DELEGATE_ACTION beside FUNCTION_CALL. The txn list was not re-fetched
// here, so a row is a candidate in either shape. It counts only after the opened
// receipt or the archival tx shows one successful ft_transfer to NEAR USDC.

export const NEAR_USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const CENSUS_FILE = "relay-census.json";
export const PROGRESS_FILE = "relay-census.progress.json";
const NEARBLOCKS = "https://api.nearblocks.io";
const ARCHIVAL_RPCS = ["https://archival-rpc.mainnet.fastnear.com", "https://archival-rpc.mainnet.near.org"];

export const RELAY_LIMITS = [
  "v1 /account/{id}/txns/count is an all-time receipt count. The same count with a date filter returns HTTP 500, so it is not N.",
  "A signed transaction on archival RPC has one Delegate action. NearBlocks receipt rows also list the inner call beside DELEGATE_ACTION. The account txn list was not re-fetched, so both shapes are candidates. A list row does not carry enough to count, so each candidate is opened.",
  "A transaction counts only when the opened record shows one Delegate whose receiver is NEAR USDC and whose only inner call is a successful ft_transfer. ft_transfer_call and any other token are left out.",
  "Relayers are the signers of that shape in a time-scattered sample of USDC ft_transfer receipts, the signers in the frozen 16:24 UTC sample, and x402-relayer2.mike.near. A relayer the sample missed is absent, so the sum is a lower bound.",
  "The 95% sample figure is a biased sample estimate. Every point of that sample is at 16:24 UTC. It is not an upper bound on N, and it does not decide the reading.",
];

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nsFromIso(iso) {
  return BigInt(Date.parse(iso)) * 1_000_000n;
}

export function isoFromNs(ns) {
  return new Date(Number(BigInt(ns) / 1_000_000n)).toISOString();
}

// One instant per day-slot inside the window, with the hour cycling through the day.
// The old sample sat on 16:24 UTC because the window opened at 04:24 and each point was half a day later.
export function scatteredInstants(fromIso, toIso, count = 30) {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!(to > from) || count < 1) throw new Error("scattered sample needs a window and a count");
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const slot = from + Math.floor(((i + 0.5) * (to - from)) / count);
    const day = new Date(slot);
    const hour = (i * 7 + 1) % 24;
    const minute = (i * 11 + 7) % 60;
    const second = (i * 5) % 50;
    let at = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, second);
    if (at < from) at += 86_400_000;
    if (at > to) at -= 86_400_000;
    if (at < from || at > to) at = slot;
    out.push(new Date(at).toISOString());
  }
  return out;
}

export function hourHistogram(isos) {
  const counts = Array(24).fill(0);
  for (const iso of isos) {
    const hour = new Date(iso).getUTCHours();
    if (Number.isInteger(hour)) counts[hour] += 1;
  }
  return counts.map((n, hour) => `${String(hour).padStart(2, "0")}:${n}`).join(" ");
}

export function judgeBounds({ lower, upper, line = thresholdLine() }) {
  if (lower >= line) return "crossed";
  if (upper < line) return "not_crossed";
  return "not_decided";
}

function actionName(action) {
  return action?.action ?? action?.action_kind ?? null;
}

function actionMethod(action) {
  return action?.method ?? action?.method_name ?? null;
}

function succeeded(status) {
  if (status === true) return true;
  return Boolean(status && typeof status === "object" && "SuccessValue" in status);
}

// Frozen usdc-delegate-sample txs use the summarized Delegate shape.
export function signerFromFrozenTx(tx, usdc = NEAR_USDC) {
  if (!tx?.signer_id) return null;
  const delegate = (tx.actions ?? []).find(
    (action) =>
      action.type === "Delegate" &&
      action.receiver_id === usdc &&
      Array.isArray(action.inner) &&
      action.inner.length === 1 &&
      action.inner[0].type === "FunctionCall" &&
      action.inner[0].method_name === "ft_transfer",
  );
  return delegate ? tx.signer_id : null;
}

export function signersFromFrozenSample(sample, usdc = NEAR_USDC) {
  const found = new Set();
  for (const tx of Object.values(sample?.txs ?? {})) {
    const signer = signerFromFrozenTx(tx, usdc);
    if (signer) found.add(signer);
  }
  return [...found].sort();
}

// A v3 account-txn list row. The token is checked when the transaction is opened.
// Protocol shape: one DELEGATE_ACTION. Receipt-index shape: that action beside one ft_transfer.
export function isListCandidate(tx) {
  const actions = tx?.actions ?? [];
  const delegates = actions.filter((action) => actionName(action) === "DELEGATE_ACTION");
  if (delegates.length !== 1) return false;
  const calls = actions.filter((action) => actionName(action) === "FUNCTION_CALL");
  if (calls.length === 0 && actions.length === 1) return true;
  return actions.length === 2 && calls.length === 1 && actionMethod(calls[0]) === "ft_transfer";
}

function walkReceipts(node, visit) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkReceipts(item, visit);
    return;
  }
  if (typeof node !== "object") return;
  visit(node);
  for (const child of node.receipts ?? []) walkReceipts(child, visit);
}

// Exactly one inner ft_transfer receipt paid to NEAR USDC, and that receipt succeeded.
export function matchDelegateUsdc(receiptRoot, signer, usdc = NEAR_USDC) {
  const inners = [];
  walkReceipts(receiptRoot, (node) => {
    const actions = node.actions ?? [];
    if (actions.length !== 1) return;
    const action = actions[0];
    if (actionName(action) !== "FUNCTION_CALL" || actionMethod(action) !== "ft_transfer") return;
    if (node.receiver_account_id !== usdc) return;
    if (!node.predecessor_account_id || node.predecessor_account_id === signer) return;
    inners.push(succeeded(node.outcome?.status));
  });
  if (inners.length === 0) return { ok: false, reason: "no_usdc_ft" };
  if (inners.length !== 1) return { ok: false, reason: "not_single" };
  if (!inners[0]) return { ok: false, reason: "inner_failed" };
  return { ok: true, reason: "counted" };
}

function innerMethod(delegate) {
  const nested = delegate?.args?.actions ?? delegate?.args?.inner ?? delegate?.inner ?? null;
  if (!Array.isArray(nested) || nested.length !== 1) return undefined;
  const inner = nested[0];
  return inner?.method ?? inner?.method_name ?? inner?.FunctionCall?.method_name ?? null;
}

// Detail endpoint: signer of one Delegate whose receiver is NEAR USDC and whose only inner call is ft_transfer.
export function signerFromDetail(tx, usdc = NEAR_USDC) {
  const status = tx?.outcomes?.status ?? tx?.outcome?.status;
  if (!tx?.signer_account_id || !succeeded(status)) return null;
  const actions = tx.actions ?? [];
  const delegate = actions.find((action) => actionName(action) === "DELEGATE_ACTION");
  if (!delegate) return null;
  const receiver = delegate.args?.receiver_id ?? delegate.receiver_id ?? null;
  if (receiver !== usdc) return null;
  const calls = actions.filter((action) => actionName(action) === "FUNCTION_CALL");
  if (calls.length === 0 && actions.length === 1) {
    return innerMethod(delegate) === "ft_transfer" ? tx.signer_account_id : null;
  }
  if (!(actions.length === 2 && calls.length === 1 && actionMethod(calls[0]) === "ft_transfer")) return null;
  return tx.signer_account_id;
}

export function matchRpcTx(result, usdc = NEAR_USDC, signer = null) {
  const tx = result?.transaction;
  if (signer && tx?.signer_id && tx.signer_id !== signer) return { ok: false, reason: "no_usdc_ft" };
  const delegate = tx?.actions?.find((action) => action.Delegate)?.Delegate?.delegate_action;
  if (!delegate || delegate.receiver_id !== usdc) return { ok: false, reason: "no_usdc_ft" };
  const innerActions = delegate.actions ?? [];
  const call = innerActions[0]?.FunctionCall;
  if (innerActions.length !== 1 || call?.method_name !== "ft_transfer") return { ok: false, reason: "not_single" };
  const receipt = (result.receipts_outcome ?? []).find((item) => item.outcome?.executor_id === usdc);
  if (!receipt) return { ok: false, reason: "no_usdc_ft" };
  const status = receipt.outcome?.status;
  if (!succeeded(status)) return { ok: false, reason: "inner_failed" };
  return { ok: true, reason: "counted" };
}

export function summarizeCensus(census, line = thresholdLine()) {
  const accounts = census.accounts ?? [];
  const lower = accounts.reduce((sum, account) => sum + account.delegate_usdc, 0);
  if (lower !== census.lower) throw new Error(`relay census lower ${census.lower} != sum ${lower}`);
  // The biased sample estimate is not a bound on N, so it cannot close the reading.
  const result = lower >= line ? "crossed" : "not_decided";
  if (census.result !== result) throw new Error(`relay census result ${census.result} != ${result}`);
  return census;
}

function emptyRejected() {
  return { no_usdc_ft: 0, not_single: 0, inner_failed: 0, unchecked: 0 };
}

function rowTimestamp(tx) {
  const raw = tx?.block_timestamp ?? tx?.block?.block_timestamp ?? tx?.included_in_block_timestamp ?? null;
  if (raw == null || raw === "") return null;
  return BigInt(raw);
}

function rowSigner(tx) {
  return tx?.signer_account_id ?? tx?.signer_id ?? null;
}

function rowHash(tx) {
  return tx?.transaction_hash ?? tx?.hash ?? null;
}

export function makeNearblocks({ fetchImpl = fetch, pauseMs = 2500, log = () => {}, sleepImpl = sleep } = {}) {
  const pace = { last: 0, pauseMs };
  async function get(url) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const wait = pace.last + pace.pauseMs - Date.now();
      if (wait > 0) await sleepImpl(wait);
      pace.last = Date.now();
      let res;
      try {
        res = await fetchImpl(url, {
          headers: { "user-agent": USER_AGENT, accept: "application/json" },
          signal: AbortSignal.timeout(40_000),
        });
      } catch (err) {
        log(`retry ${attempt + 1}: ${err.message}`);
        await sleepImpl(5_000 * (attempt + 1));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        pace.pauseMs = Math.min(pace.pauseMs * 2, 20_000);
        const backoff = Math.min(30_000, Math.max(pace.pauseMs, 8_000 * (attempt + 1)));
        log(`HTTP ${res.status}. Pause ${pace.pauseMs / 1000}s, wait ${backoff / 1000}s`);
        await sleepImpl(backoff);
        pace.last = Date.now();
        continue;
      }
      if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
      pace.pauseMs = Math.max(pauseMs, Math.floor(pace.pauseMs * 0.95));
      pace.last = Date.now();
      return res.json();
    }
    throw new Error(`${url} failed after retries`);
  }
  let turn = 0;
  const rpcPace = { pauseMs: 800 };
  async function rpc(hash, signer) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const url = ARCHIVAL_RPCS[turn % ARCHIVAL_RPCS.length];
      turn += 1;
      await sleepImpl(rpcPace.pauseMs);
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": USER_AGENT },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tx",
            params: { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" },
          }),
          signal: AbortSignal.timeout(40_000),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (body.error) return { error: JSON.stringify(body.error).slice(0, 200) };
        rpcPace.pauseMs = Math.max(800, Math.floor(rpcPace.pauseMs * 0.95));
        return { result: body.result };
      } catch (err) {
        rpcPace.pauseMs = Math.min(8_000, rpcPace.pauseMs * 2);
        log(`RPC retry ${attempt + 1}: ${err.message}. Pause ${rpcPace.pauseMs / 1000}s`);
        await sleepImpl(rpcPace.pauseMs);
      }
    }
    return { error: "rpc failed after retries" };
  }
  return { get, rpc };
}

async function getSteady(get, url, log, sleepImpl = sleep) {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await get(url);
    } catch (err) {
      last = err;
      log(`fetch again ${attempt + 1}: ${err.message}. Wait 60s`);
      await sleepImpl(60_000);
    }
  }
  throw last;
}

async function openCandidate(get, rpc, hash, signer, usdc) {
  const opened = await rpc(hash, signer);
  if (opened.result) return matchRpcTx(opened.result, usdc, signer);
  try {
    const body = await get(`${NEARBLOCKS}/v3/txns/${hash}/receipts`);
    return matchDelegateUsdc(body.data ?? body, signer, usdc);
  } catch (err) {
    return { ok: false, reason: "unchecked", error: opened.error ?? err.message };
  }
}

export async function listCandidates(get, account, window, { maxPages = 2000, log = () => {} } = {}) {
  const fromNs = nsFromIso(window.from);
  const toNs = nsFromIso(window.to);
  const base = `${NEARBLOCKS}/v3/accounts/${account}/txns?limit=100&before_ts=${toNs + 1_000_000n}`;
  const candidates = [];
  const kinds = {};
  let scanned = 0;
  let pages = 0;
  let complete = false;
  let next = null;
  for (let i = 0; i < maxPages; i += 1) {
    const url = next ? `${base}&next=${encodeURIComponent(next)}` : base;
    const body = await getSteady(get, url, log);
    const rows = body.data ?? [];
    pages += 1;
    if (rows.length === 0) {
      complete = true;
      break;
    }
    for (const tx of rows) {
      const ts = rowTimestamp(tx);
      if (ts == null || ts > toNs || ts < fromNs) continue;
      if (rowSigner(tx) !== account) continue;
      scanned += 1;
      const key = (tx.actions ?? []).map((action) => `${actionName(action)}:${actionMethod(action) ?? ""}`).join("+") || "(none)";
      kinds[key] = (kinds[key] ?? 0) + 1;
      const hash = rowHash(tx);
      if (hash && isListCandidate(tx)) candidates.push({ hash, at: isoFromNs(ts) });
    }
    const oldest = rowTimestamp(rows[rows.length - 1]);
    next = body.meta?.next_page ?? null;
    if (pages % 10 === 0) log(`${account.slice(0, 8)} page ${pages}, in window ${scanned}, candidates ${candidates.length}`);
    if (oldest == null || oldest < fromNs || !next) {
      complete = true;
      break;
    }
  }
  return { candidates, scanned, pages, kinds, complete };
}

function singleFtTransfer(row) {
  const actions = row.actions ?? [];
  return (
    succeeded(row.outcome_status) &&
    actions.length === 1 &&
    actionName(actions[0]) === "FUNCTION_CALL" &&
    actionMethod(actions[0]) === "ft_transfer"
  );
}

export async function discoverSigners(get, window, { points = 30, perPoint = 8, usdc = NEAR_USDC, log = () => {}, resume = null, onPoint = async () => {} } = {}) {
  const instants = resume?.instants ?? scatteredInstants(window.from, window.to, points);
  const seen = new Set(resume?.seen ?? []);
  const hits = resume?.hits ?? [];
  const pointRows = resume?.pointRows ?? [];
  const doneBefore = new Set(pointRows.map((point) => point.before));
  for (const before of instants) {
    if (doneBefore.has(before)) continue;
    const ns = nsFromIso(before);
    const url = `${NEARBLOCKS}/v3/accounts/${usdc}/receipts?method=ft_transfer&before_ts=${ns}&limit=${perPoint}`;
    const body = await getSteady(get, url, log);
    const rows = body.data ?? [];
    let delegates = 0;
    for (const row of rows) {
      const receiptId = row.receipt_id;
      const hash = rowHash(row);
      if (!receiptId || !hash || seen.has(hash)) continue;
      if (!singleFtTransfer({ ...row, outcome_status: row.outcome?.status ?? row.outcome_status })) continue;
      seen.add(hash);
      let signer = null;
      try {
        const detail = await get(`${NEARBLOCKS}/v3/txns/${hash}`);
        signer = signerFromDetail(detail.data ?? detail, usdc);
      } catch (err) {
        log(`skip, detail did not open ${hash}: ${err.message}`);
        continue;
      }
      if (!signer) continue;
      delegates += 1;
      const stamp = row.block?.block_timestamp ?? row.block_timestamp ?? row.included_in_block_timestamp ?? ns;
      hits.push({ hash, signer, at: isoFromNs(stamp) });
    }
    pointRows.push({ before, receipts: rows.length, delegates });
    log(`sample ${before} receipts ${rows.length} matched ${delegates}`);
    await onPoint({ instants, seen: [...seen], hits, pointRows });
  }
  return {
    points: pointRows,
    hours: hourHistogram(instants),
    hits,
    signers: [...new Set(hits.map((hit) => hit.signer))].sort(),
  };
}

export async function censusAccount(get, rpc, account, window, { usdc = NEAR_USDC, log = () => {}, resume = null, onProgress = () => {} } = {}) {
  const listed = resume?.listed ?? (await listCandidates(get, account, window, { log }));
  if (!resume?.listed) log(`${account.slice(0, 8)} candidates ${listed.candidates.length}, in window ${listed.scanned}, complete ${listed.complete}`);
  const rejected = resume?.rejected ?? emptyRejected();
  const counted = resume?.counted ?? [];
  const done = new Set(resume?.done ?? []);
  let opened = done.size;
  for (const candidate of listed.candidates) {
    if (done.has(candidate.hash)) continue;
    const match = await openCandidate(get, rpc, candidate.hash, account, usdc);
    opened += 1;
    done.add(candidate.hash);
    if (match.ok) counted.push(candidate);
    else rejected[match.reason] = (rejected[match.reason] ?? 0) + 1;
    if (opened % 25 === 0) {
      log(`${account.slice(0, 8)} opened ${opened}/${listed.candidates.length} matched ${counted.length}`);
      await onProgress({ listed, rejected, counted, done: [...done] });
    }
  }
  counted.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.hash < b.hash ? -1 : 1));
  return {
    account,
    txs_in_window: listed.scanned,
    pages: listed.pages,
    list_complete: listed.complete,
    candidates: listed.candidates.length,
    delegate_usdc: counted.length,
    rejected,
    unchecked: rejected.unchecked,
    complete: listed.complete && rejected.unchecked === 0,
    first_at: counted[0]?.at ?? null,
    last_at: counted[counted.length - 1]?.at ?? null,
    action_kinds: listed.kinds,
    hashes: counted.map((row) => row.hash),
  };
}

export async function buildRelayCensus({
  get,
  rpc,
  window,
  upper,
  estimate,
  line = thresholdLine(),
  extraSigners = [],
  points = 30,
  perPoint = 8,
  usdc = NEAR_USDC,
  log = () => {},
  progressPath,
}) {
  if (!progressPath) throw new Error("relay census needs a progress file path");
  let saved = null;
  try {
    saved = JSON.parse(await readFile(progressPath, "utf8"));
    if (saved.window?.from !== window.from || saved.window?.to !== window.to) saved = null;
  } catch {
    saved = null;
  }
  const sample =
    saved?.sample ??
    (await discoverSigners(get, window, {
      points,
      perPoint,
      usdc,
      log,
      resume: saved?.discover ?? null,
      onPoint: async (discover) => {
        await writeFile(progressPath, JSON.stringify({ window, discover, rows: [] }));
      },
    }));
  if (!saved?.sample) {
    await writeFile(progressPath, JSON.stringify({ window, sample, rows: [] }));
    log(`wrote the sample to ${progressPath}`);
  }
  const accounts = [...new Set([...extraSigners, ...sample.signers])].sort();
  log(`relays ${accounts.length}`);
  const rows = saved?.rows ?? [];
  const finished = new Set(rows.map((row) => row.account));
  for (const account of accounts) {
    if (finished.has(account)) continue;
    const resume = saved?.open?.account === account ? saved.open : null;
    const row = await censusAccount(get, rpc, account, window, {
      usdc,
      log,
      resume,
      onProgress: async (open) => {
        await writeFile(progressPath, JSON.stringify({ window, sample, rows, open: { account, ...open } }));
      },
    });
    row.found_in = [
      ...(extraSigners.includes(account) ? ["frozen_or_known"] : []),
      ...(sample.signers.includes(account) ? ["scattered_sample"] : []),
    ];
    rows.push(row);
    await writeFile(progressPath, JSON.stringify({ window, sample, rows }));
    log(`${account} count ${row.delegate_usdc} complete=${row.complete}`);
  }
  const lower = rows.reduce((sum, row) => sum + row.delegate_usdc, 0);
  const result = lower >= line ? "crossed" : "not_decided";
  return {
    window,
    method:
      "Scattered NearBlocks USDC ft_transfer receipts, each transaction opened on v3 /txns/{hash}. Each known relayer's signed transactions over the same 30 days were paged on v3 /accounts/{id}/txns. A candidate is one DELEGATE_ACTION, with or without a sibling ft_transfer. Each candidate was opened on archival RPC, or on /txns/{hash}/receipts if the RPC call failed.",
    sample_hours: sample.hours,
    sample_points: sample.points,
    sample_hits: sample.hits,
    biased_sample_estimate: upper,
    biased_sample_estimate_kind: "clopper_pearson_95_not_N",
    estimate,
    bias: "biased_sample_estimate is the one-sided 95% sample figure. The sample points all fall at 16:24:35 UTC, in 30 clusters of 15 receipts, so the interval is optimistic. It is not an upper bound on N and it does not decide the reading. Relayers the sample missed are absent from the lower bound.",
    line,
    accounts: rows,
    lower,
    result,
    list_complete: rows.length > 0 && rows.every((row) => row.complete),
  };
}
