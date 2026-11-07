import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { USER_AGENT } from "../http.mjs";
import { thresholdLine } from "../threshold.mjs";
import { isoFromNs, matchRpcTx, NEAR_USDC } from "./relay-census.mjs";

// 30-day count of delegate-action USDC ft_transfers signed by known relay accounts.
// FastNEAR POST /v0/account lists the account. POST /v0/transactions opens each hash.
// The opened body is the same Delegate shape matchRpcTx already counts, after the
// receipt outcomes are lifted into receipts_outcome.

export const FASTNEAR_TX_ORIGIN = "https://tx.main.fastnear.com";
export const FACILITATORS_FILE = "facilitators.json";

export const FASTNEAR_LIMITS = [
  "On the relayer's /v0/account row, a delegate settlement has is_signer true and is_real_signer false. is_real_signer true on that same hash is the payer, the delegate sender. Filtering the relayer with is_real_signer drops the settlements. This count lists is_signer and then opens the transaction.",
  "The list row has no actions. Every signer transaction in the window is opened. A transaction counts only when matchRpcTx accepts it: one Delegate, receiver NEAR USDC, one inner ft_transfer, and the USDC receipt succeeded. Exactly one USDC execution outcome is required.",
  "The sum is a lower bound on N. A relayer this survey did not name is absent. Delegate transfers signed by an account that is not in this file are absent. N also includes transfers that are not x402.",
  "The window is closed at the tip block read when the census started. Blocks after that tip are outside it. Block time is the FastNEAR block timestamp, not a clock on this machine.",
  "x402-relayer2.mike.near is the signer named by the FastNEAR reference config and by the live x402.mikedotexe.com /supported response. Those are one account, counted once.",
  "solvador.near and uvd-facilitator.near are the signer or fee payer their public /supported responses name. An escrow scheme on the same host is not this count.",
  "x402-relayer.mike.near was provisioned as a mainnet relayer. The provisioning note says that record is not evidence the service was live. The live signer is x402-relayer2.mike.near.",
];

export function fastnearTxToRpcResult(entry) {
  if (!entry?.transaction) return null;
  const receipts_outcome = [];
  if (entry.execution_outcome) receipts_outcome.push(entry.execution_outcome);
  for (const row of entry.receipts ?? []) {
    if (row?.execution_outcome) receipts_outcome.push(row.execution_outcome);
  }
  return { transaction: entry.transaction, receipts_outcome };
}

// One successful Delegate ft_transfer to NEAR USDC, signed by `signer`.
export function classifyFastnearTx(entry, signer, usdc = NEAR_USDC) {
  const result = fastnearTxToRpcResult(entry);
  if (!result?.transaction) return { ok: false, reason: "unchecked" };
  const outer = result.transaction.actions ?? [];
  const delegates = outer.filter((action) => action.Delegate);
  if (delegates.length !== 1) return { ok: false, reason: delegates.length === 0 ? "no_usdc_ft" : "not_single" };
  const usdcReceipts = result.receipts_outcome.filter((item) => item?.outcome?.executor_id === usdc);
  const match = matchRpcTx(result, usdc, signer);
  if (!match.ok) return match;
  if (usdcReceipts.length !== 1) return { ok: false, reason: "not_single" };
  return match;
}

export function isoFromFastnearNs(ns) {
  if (ns == null || ns === "") return null;
  return isoFromNs(BigInt(ns));
}

export function judgeKnownRelays({ lower, line = thresholdLine() }) {
  if (lower >= line) return "crossed";
  return "not_decided";
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function stampFacilitators(doc) {
  const body = { ...doc, sha256: "" };
  const hashed = `${JSON.stringify(body, null, 2)}\n`;
  body.sha256 = sha256(hashed);
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function readStampedFacilitators(text) {
  const doc = JSON.parse(text);
  const hash = doc.sha256;
  if (typeof hash !== "string" || hash.length !== 64) throw new Error("facilitators.json has no sha256");
  const again = `${JSON.stringify({ ...doc, sha256: "" }, null, 2)}\n`;
  const got = sha256(again);
  if (got !== hash) throw new Error(`facilitators.json sha256 mismatch: got ${got}, want ${hash}`);
  const lower = (doc.accounts ?? []).reduce((sum, account) => sum + account.delegate_usdc, 0);
  if (lower !== doc.lower) throw new Error(`facilitators lower ${doc.lower} != sum ${lower}`);
  const result = judgeKnownRelays({ lower, line: doc.line });
  if (doc.result !== result) throw new Error(`facilitators result ${doc.result} != ${result}`);
  return doc;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeFastnear({ fetchImpl = fetch, pauseMs = 120, log = () => {}, sleepImpl = sleep } = {}) {
  async function post(path, body) {
    const url = `${FASTNEAR_TX_ORIGIN}${path}`;
    let last = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (pauseMs) await sleepImpl(pauseMs);
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": USER_AGENT, accept: "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.status === 429 || res.status >= 500) {
          const wait = Math.min(30_000, 1_500 * 2 ** attempt);
          log(`HTTP ${res.status} ${path}。${wait / 1000}秒待つ`);
          await sleepImpl(wait);
          last = new Error(`HTTP ${res.status}`);
          continue;
        }
        if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        last = err;
        if (String(err.message).includes("HTTP 4")) throw err;
        const wait = Math.min(20_000, 1_000 * (attempt + 1));
        log(`再試行 ${attempt + 1} ${path}: ${err.message}`);
        await sleepImpl(wait);
      }
    }
    throw last ?? new Error(`${path} failed`);
  }
  return { post };
}

export async function windowFromTip(post, { days = 30 } = {}) {
  const listed = await post("/v0/blocks", { limit: 1 });
  const tip = listed.blocks?.[0];
  if (!tip?.block_height || tip.block_timestamp == null) throw new Error("FastNEAR tip block missing");
  const toHeight = tip.block_height;
  const toNs = BigInt(tip.block_timestamp);
  const span = BigInt(days) * 86_400n * 1_000_000_000n;
  const target = toNs - span;
  let lo = Math.max(1, toHeight - days * 86_400 * 2);
  let hi = toHeight;
  let guard = 0;
  while (lo + 1 < hi && guard < 32) {
    const mid = Math.floor((lo + hi) / 2);
    const block = await post("/v0/block", { block_id: mid });
    const ts = BigInt(block.block.block_timestamp);
    if (ts < target) lo = mid;
    else hi = mid;
    guard += 1;
  }
  const fromBlock = await post("/v0/block", { block_id: hi });
  const prev = await post("/v0/block", { block_id: hi - 1 });
  return {
    days,
    from_height: hi,
    to_height: toHeight,
    from_ns: String(fromBlock.block.block_timestamp),
    to_ns: String(toNs),
    prev_ns: String(prev.block.block_timestamp),
    from: isoFromFastnearNs(fromBlock.block.block_timestamp),
    to: isoFromFastnearNs(toNs),
    target_ns: String(target),
  };
}

export async function listSignerTxs(post, account, window, { log = () => {} } = {}) {
  const rows = [];
  const seen = new Set();
  let resume = null;
  let reported = null;
  for (let page = 0; page < 500; page += 1) {
    const body = {
      account_id: account,
      is_signer: true,
      from_tx_block_height: window.from_height,
      to_tx_block_height: window.to_height,
      limit: 200,
      desc: false,
    };
    if (resume) body.resume_token = resume;
    const data = await post("/v0/account", body);
    if (reported == null) reported = data.txs_count ?? null;
    const batch = data.account_txs ?? [];
    for (const row of batch) {
      const hash = row.transaction_hash;
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      rows.push({
        hash,
        height: row.tx_block_height ?? null,
        at: isoFromFastnearNs(row.tx_block_timestamp),
        is_real_signer: row.is_real_signer === true,
        is_success: row.is_success === true,
      });
    }
    resume = data.resume_token ?? null;
    if (page % 5 === 0) log(`${account.slice(0, 12)} ページ ${page + 1} 件 ${rows.length}`);
    if (!resume || batch.length === 0) break;
  }
  rows.sort((a, b) => (a.height ?? 0) - (b.height ?? 0) || (a.hash < b.hash ? -1 : 1));
  return { rows, reported, list_complete: reported == null || reported === rows.length };
}

function emptyRejected() {
  return { no_usdc_ft: 0, not_single: 0, inner_failed: 0, unchecked: 0 };
}

export async function countSignerTxs(post, account, listed, { usdc = NEAR_USDC, log = () => {}, onProgress = () => {}, done = new Set() } = {}) {
  const rejected = emptyRejected();
  const counted = [];
  const pending = listed.rows.filter((row) => !done.has(row.hash));
  for (let i = 0; i < pending.length; i += 20) {
    const slice = pending.slice(i, i + 20);
    const hashes = slice.map((row) => row.hash);
    let data = await post("/v0/transactions", { tx_hashes: hashes });
    let txs = data.transactions ?? [];
    if (txs.length !== slice.length) {
      data = await post("/v0/transactions", { tx_hashes: hashes });
      txs = data.transactions ?? [];
    }
    if (txs.length !== slice.length) {
      for (const row of slice) {
        rejected.unchecked += 1;
        done.add(row.hash);
      }
    } else {
      for (let j = 0; j < slice.length; j += 1) {
        const row = slice[j];
        const match = classifyFastnearTx(txs[j], account, usdc);
        done.add(row.hash);
        if (match.ok) counted.push({ hash: row.hash, at: row.at, height: row.height });
        else rejected[match.reason] = (rejected[match.reason] ?? 0) + 1;
      }
    }
    if ((i / 20) % 10 === 0) {
      log(`${account.slice(0, 12)} 開封 ${done.size}/${listed.rows.length} 該当 ${counted.length}`);
      await onProgress({ done: [...done], counted, rejected });
    }
  }
  counted.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.hash < b.hash ? -1 : 1));
  return { counted, rejected, opened: done.size };
}

export function facilitatorsDocument({ window, accounts, retrieved_at, upper, estimate, line = thresholdLine() }) {
  const lower = accounts.reduce((sum, account) => sum + account.delegate_usdc, 0);
  return {
    sha256: "",
    retrieved_at,
    usdc: NEAR_USDC,
    window,
    method:
      "POST https://tx.main.fastnear.com/v0/account with is_signer true and the block-height window, then POST /v0/transactions in batches of 20. Each body is classified by the same Delegate rule as matchRpcTx: one outer Delegate, receiver NEAR USDC, one inner ft_transfer, one successful USDC receipt. is_real_signer is not the relayer filter.",
    line,
    upper,
    upper_kind: "existing_estimate_upper_95",
    estimate,
    accounts,
    lower,
    result: judgeKnownRelays({ lower, line }),
    list_complete: accounts.length > 0 && accounts.every((account) => account.list_complete && account.unchecked === 0),
    limits: FASTNEAR_LIMITS,
  };
}

export async function loadFacilitators(dir) {
  try {
    const text = await readFile(`${dir}/${FACILITATORS_FILE}`, "utf8");
    return readStampedFacilitators(text);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function writeFacilitators(dir, doc) {
  const text = stampFacilitators(doc);
  await writeFile(`${dir}/${FACILITATORS_FILE}`, text);
  return readStampedFacilitators(text);
}
