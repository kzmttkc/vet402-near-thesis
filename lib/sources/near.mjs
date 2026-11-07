import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { USER_AGENT } from "../http.mjs";
import { record } from "../numbers.mjs";
import { judgeThreshold, thresholdLine, THRESHOLD } from "../threshold.mjs";
import { loadFacilitators } from "./fastnear-census.mjs";
import {
  buildRelayCensus,
  CENSUS_FILE,
  makeNearblocks,
  PROGRESS_FILE,
  RELAY_LIMITS,
  signersFromFrozenSample,
  summarizeCensus,
} from "./relay-census.mjs";

// NEAR sources for `node thesis.mjs --fetch-near`. Every source is free and needs no key.
// The default run reads the frozen copies in data/snapshot/near/ and checks their sha256.

export const NEAR_USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const RELAYER = "x402-relayer2.mike.near";
export const ESCROW = "escrow.ai.near";
export const INTENTS = "intents.near";
export const ARCHIVAL_RPC = "https://archival-rpc.mainnet.fastnear.com";
export const ARCHIVAL_RPCS = [ARCHIVAL_RPC, "https://archival-rpc.mainnet.near.org"];
const NEARBLOCKS = "https://api.nearblocks.io";
const DAY_MS = 86_400_000;

export const URLS = {
  spec: "https://raw.githubusercontent.com/x402-foundation/x402/main/specs/schemes/exact/scheme_exact_near.md",
  spec_commits:
    "https://api.github.com/repos/x402-foundation/x402/commits?path=specs/schemes/exact/scheme_exact_near.md&per_page=100",
  spec_pr: "https://api.github.com/repos/x402-foundation/x402/pulls/1459",
  supported: "https://x402.mikedotexe.com/supported",
  discovery: "https://x402.mikedotexe.com/discovery/resources",
  mpp: "https://mpp.dev/payment-methods/nearintents",
  usdc_stats: `${NEARBLOCKS}/v3/fts/${NEAR_USDC}/stats/transfers?limit=40`,
  relayer_receipts: `${NEARBLOCKS}/v3/accounts/${RELAYER}/receipts?limit=100`,
  usdc_receipts: `${NEARBLOCKS}/v3/accounts/${NEAR_USDC}/receipts?method=ft_transfer`,
  escrow_txns: `${NEARBLOCKS}/v3/accounts/${ESCROW}/txns?receiver=${INTENTS}&limit=100`,
};

export const FILES = {
  spec: "x402-scheme_exact_near.md",
  spec_commits: "x402-scheme_exact_near.commits.json",
  spec_pr: "x402-pr-1459.json",
  supported: "facilitator-supported.json",
  discovery: "facilitator-discovery-resources.json",
  mpp: "mpp-nearintents.md",
  usdc_stats: "usdc-transfer-stats.json",
  relayer: "relayer-receipts.json",
  relayer_payments: "relayer-payments.json",
  delegate: "usdc-delegate-sample.json",
  escrow: "escrow-execute-intents.json",
};

export const MANIFEST = "manifest.json";

export const DELEGATE_LIMITS = [
  "NearBlocks v3 count endpoints are closed to callers without a key (HTTP 403), and the v1 count with a date filter returns Server Error, so the 30-day N cannot be counted in full without a key.",
  "NearBlocks lists a delegated ft_transfer receipt with predecessor = the payer and the same action as a direct call, so each receipt is opened on NEAR archival RPC: EXPERIMENTAL_receipt gives signer_id, and when signer_id differs from the predecessor, tx gives the outer Delegate action.",
  "Only the sampled receipts are counted. The estimate scales the sample share by NearBlocks daily USDC transfer events, which include every transfer shape, so it is an upper estimate of N, not a count.",
  "Public archival RPCs answer callers without a key with HTTP 429 when asked too fast, so the sample is kept small (15 receipts at each of 30 points). A receipt the RPC never answered is counted as unchecked, not as a miss.",
  "Sample points are evenly spaced, one per day. Each takes the newest receipts before that instant, so bursts in those minutes weigh more than they would in a random sample.",
];

export const ESCROW_LIMITS = [
  "One sample: the newest transactions signed by escrow.ai.near at the fetch time, not a 30-day count.",
  "Retries re-sign the same transfer with a new nonce and deadline, so duplicates are removed by the intent body (signer_id and intents, deadline and nonce dropped). The intent_hash values in the logs are kept too.",
  "escrow.ai.near being the NEAR AI Agent Market escrow is an estimate: the Agent Market payment docs do not name this account.",
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nsFromMs(ms) {
  return (BigInt(Math.floor(ms)) * 1_000_000n).toString();
}

function isoFromNs(ns) {
  return new Date(Number(BigInt(ns) / 1_000_000n)).toISOString();
}

function decodeArgs(b64) {
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ---------- pure readers (used by --offline and by the tests) ----------

function actionList(row) {
  return (row.actions ?? []).map((a) => [a.action, a.method ?? null]);
}

export function relayerKind(row) {
  const actions = actionList(row);
  const names = actions.map(([a]) => a);
  if (
    row.predecessor_account_id === RELAYER &&
    names.includes("DELEGATE_ACTION") &&
    actions.some(([a, m]) => a === "FUNCTION_CALL" && m === "ft_transfer")
  ) {
    return "payment";
  }
  if (row.predecessor_account_id === "system" && names.every((a) => a === "TRANSFER")) return "gas_refund";
  if (names.includes("CREATE_ACCOUNT") || names.includes("ADD_KEY")) return "account_setup";
  if (names.length > 0 && names.every((a) => a === "TRANSFER")) return "funding";
  return "other";
}

// One payment from an RPC `tx` result: the Delegate action and the inner ft_transfer outcome.
export function paymentFromTx(result) {
  const tx = result?.transaction;
  const delegate = tx?.actions?.find((a) => a.Delegate)?.Delegate?.delegate_action;
  if (!delegate) return null;
  const call = delegate.actions?.[0]?.FunctionCall;
  const args = call ? decodeArgs(call.args) : null;
  const inner = (result.receipts_outcome ?? []).find((o) => o.outcome?.executor_id === delegate.receiver_id);
  return {
    hash: tx.hash,
    signer_id: tx.signer_id,
    sender_id: delegate.sender_id,
    token: delegate.receiver_id,
    method: call?.method_name ?? null,
    ft_receiver: args?.receiver_id ?? null,
    amount_raw: args?.amount ?? null,
    inner_success: Boolean(inner && inner.outcome.status && "SuccessValue" in inner.outcome.status),
  };
}

export function relayerSummary(relayer, payments) {
  const kinds = { payment: 0, gas_refund: 0, account_setup: 0, funding: 0, other: 0 };
  for (const row of relayer.rows) kinds[relayerKind(row)] += 1;
  const paymentRows = relayer.rows.filter((r) => relayerKind(r) === "payment");
  const byHash = new Map(payments.payments.map((p) => [p.hash, p]));
  const list = paymentRows.map((row) => {
    const p = byHash.get(row.transaction_hash) ?? {};
    return {
      hash: row.transaction_hash,
      at: isoFromNs(row.block.block_timestamp),
      sender_id: p.sender_id ?? null,
      token: p.token ?? null,
      ft_receiver: p.ft_receiver ?? null,
      amount_usdc: p.amount_raw == null ? null : Number(p.amount_raw) / 1e6,
      inner_success: p.inner_success ?? null,
    };
  });
  list.sort((a, b) => (a.at < b.at ? -1 : 1));
  const amounts = list.map((p) => p.amount_usdc).filter((v) => v != null);
  return {
    receipts: relayer.rows.length,
    transactions: new Set(relayer.rows.map((r) => r.transaction_hash)).size,
    kinds,
    payments: list,
    payment_count: list.length,
    payment_usdc_total: amounts.reduce((s, v) => s + v, 0),
    payment_usdc_min: amounts.length ? Math.min(...amounts) : null,
    payment_usdc_max: amounts.length ? Math.max(...amounts) : null,
    payment_first_at: list[0]?.at ?? null,
    payment_last_at: list[list.length - 1]?.at ?? null,
    payment_tokens: [...new Set(list.map((p) => p.token))],
    payment_senders: [...new Set(list.map((p) => p.sender_id))],
    payment_receivers: [...new Set(list.map((p) => p.ft_receiver))],
    all_inner_success: list.every((p) => p.inner_success === true),
  };
}

// Classify one sampled USDC receipt with the RPC answers stored next to it.
export function classifySampled(row, receipts, txs) {
  if (row.outcome_status !== true) return "failed";
  const actions = actionList(row);
  if (!(actions.length === 1 && actions[0][0] === "FUNCTION_CALL" && actions[0][1] === "ft_transfer")) {
    return "not_single_ft_transfer";
  }
  const rc = receipts[row.receipt_id];
  if (!rc || rc.error) return "unchecked";
  if (rc.signer_id === rc.predecessor_id) return "direct";
  const tx = txs[row.transaction_hash];
  if (!tx || tx.error) return "unchecked";
  const delegate = (tx.actions ?? []).find(
    (a) =>
      a.type === "Delegate" &&
      a.sender_id === row.predecessor_account_id &&
      a.receiver_id === NEAR_USDC &&
      a.inner.length === 1 &&
      a.inner[0].type === "FunctionCall" &&
      a.inner[0].method_name === "ft_transfer",
  );
  return delegate ? "delegate" : "contract_call";
}

// Clopper-Pearson upper bound for k hits in n draws.
export function binomialUpper(k, n, alpha = 0.05) {
  if (n <= 0) return 1;
  if (k >= n) return 1;
  const cdf = (p) => {
    // P(X <= k) for X ~ Bin(n, p)
    let term = (1 - p) ** n;
    let sum = term;
    for (let i = 1; i <= k; i += 1) {
      term *= ((n - i + 1) / i) * (p / (1 - p));
      sum += term;
    }
    return sum;
  };
  let lo = k / n;
  let hi = 1;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) > alpha) lo = mid;
    else hi = mid;
  }
  return hi;
}

// Sum NearBlocks daily USDC transfer events over the 30 whole UTC days before the window end.
export function transfers30d(stats, windowToIso) {
  const endDay = windowToIso.slice(0, 10);
  const days = (stats.data ?? [])
    .filter((d) => d.date < endDay)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);
  if (days.length < 30) throw new Error(`usdc transfer stats need 30 days, have ${days.length}`);
  return {
    total: days.reduce((s, d) => s + Number(d.transfers_count), 0),
    from: days[days.length - 1].date,
    to: days[0].date,
  };
}

export function delegateSummary(sample, stats, line = thresholdLine()) {
  const seen = new Set();
  const counts = {
    sampled: 0,
    failed: 0,
    not_single_ft_transfer: 0,
    direct: 0,
    contract_call: 0,
    delegate: 0,
    unchecked: 0,
  };
  const hits = [];
  for (const point of sample.points) {
    for (const row of point.rows) {
      if (seen.has(row.receipt_id)) continue;
      seen.add(row.receipt_id);
      counts.sampled += 1;
      const kind = classifySampled(row, sample.receipts, sample.txs);
      counts[kind] += 1;
      if (kind === "delegate") hits.push({ receipt_id: row.receipt_id, hash: row.transaction_hash, at: isoFromNs(row.block_timestamp) });
    }
  }
  const checked = counts.direct + counts.contract_call + counts.delegate;
  const successful = checked + counts.not_single_ft_transfer;
  const transfers = transfers30d(stats, sample.window.to);
  const share = successful > 0 ? counts.delegate / successful : 0;
  const shareUpper = binomialUpper(counts.delegate, successful);
  const estimate = share * transfers.total;
  const estimateUpper = Math.ceil(shareUpper * transfers.total);
  return {
    window: sample.window,
    points: sample.points.length,
    per_point: sample.per_point,
    counts,
    successful,
    hits,
    share,
    share_upper_95: shareUpper,
    transfers_30d: transfers,
    estimate,
    estimate_upper_95: estimateUpper,
    line,
    result: judgeThreshold({ counted: counts.delegate, complete: false, line }),
    estimate_upper_below_line: estimateUpper < line,
  };
}

function escrowClass(status) {
  if (status && "SuccessValue" in status) return "success";
  const text = JSON.stringify(status ?? {});
  if (/invalid intent/i.test(text)) return "invalid_intent";
  if (/insufficient balance/i.test(text)) return "insufficient_balance";
  return "other";
}

function intentKey(signed) {
  let message = signed?.payload?.message;
  try {
    message = typeof message === "string" ? JSON.parse(message) : message;
  } catch {
    return `raw:${sha256(String(message))}`;
  }
  const body = { signer_id: message?.signer_id ?? null, intents: message?.intents ?? null };
  return sha256(JSON.stringify(body));
}

export function escrowSummary(escrow) {
  const perTx = { success: 0, invalid_intent: 0, insufficient_balance: 0, other: 0, unchecked: 0 };
  const byIntent = new Map();
  const intentHashes = new Set();
  const otherMessages = {};
  const order = { success: 3, insufficient_balance: 2, invalid_intent: 1, other: 0 };
  for (const tx of escrow.txs) {
    if (tx.error || !tx.execute) {
      perTx.unchecked += 1;
      continue;
    }
    const cls = escrowClass(tx.execute.status);
    perTx[cls] += 1;
    if (cls === "other") {
      const msg = JSON.stringify(tx.execute.status).match(/"ExecutionError":"([^"]*)"/)?.[1] ?? JSON.stringify(tx.execute.status).slice(0, 120);
      otherMessages[msg] = (otherMessages[msg] ?? 0) + 1;
    }
    for (const h of tx.execute.intent_hashes ?? []) intentHashes.add(h);
    for (const signed of tx.args?.signed ?? []) {
      const key = intentKey(signed);
      const prev = byIntent.get(key);
      if (!prev || order[cls] > order[prev]) byIntent.set(key, cls);
    }
  }
  const perIntent = { success: 0, invalid_intent: 0, insufficient_balance: 0, other: 0 };
  for (const cls of byIntent.values()) perIntent[cls] += 1;
  const times = escrow.txs.map((t) => t.at).filter(Boolean).sort();
  return {
    txs: escrow.txs.length,
    from: times[0] ?? null,
    to: times[times.length - 1] ?? null,
    per_tx: perTx,
    unique_intents: byIntent.size,
    unique_intent_hashes: intentHashes.size,
    per_intent: perIntent,
    other_messages: otherMessages,
  };
}

export function specSummary(specText, commits, pr) {
  const list = Array.isArray(commits) ? commits : [];
  const dates = list.map((c) => c?.commit?.committer?.date).filter(Boolean).sort();
  return {
    sha256: sha256(specText),
    bytes: Buffer.byteLength(specText),
    commits: dates.length,
    first_commit_at: dates[0] ?? null,
    last_commit_at: dates[dates.length - 1] ?? null,
    last_commit_sha: list[0]?.sha ?? null,
    pr_number: pr?.number ?? null,
    pr_merged_at: pr?.merged_at ?? null,
    pr_user: pr?.user?.login ?? null,
    settlement_sentence: /outer-transaction success is not sufficient/i.test(specText),
  };
}

export function facilitatorSummary(supported, discovery) {
  const kinds = supported?.kinds ?? [];
  return {
    kinds: kinds.map((k) => `${k.scheme}:${k.network}:v${k.x402Version}`),
    signers: supported?.signers ?? {},
    discovery_total: discovery?.pagination?.total ?? null,
    discovery_items: Array.isArray(discovery?.items) ? discovery.items.length : null,
  };
}

// ---------- offline load: check every sha256, then derive ----------

export async function verifyNearSnapshot(dir) {
  const manifest = JSON.parse(await readFile(join(dir, MANIFEST), "utf8"));
  const texts = {};
  for (const [key, name] of Object.entries(FILES)) {
    const entry = manifest.files?.[name];
    if (!entry) throw new Error(`near snapshot manifest has no ${name}`);
    const text = await readFile(join(dir, name), "utf8");
    const got = sha256(text);
    if (got !== entry.sha256) throw new Error(`near snapshot ${name} sha256 mismatch: got ${got}, want ${entry.sha256}`);
    texts[key] = text;
  }
  return { manifest, texts };
}

export function nearFromTexts(manifest, texts) {
  const json = (k) => JSON.parse(texts[k]);
  const spec = specSummary(texts.spec, json("spec_commits"), json("spec_pr"));
  const facilitator = facilitatorSummary(json("supported"), json("discovery"));
  const relayer = relayerSummary(json("relayer"), json("relayer_payments"));
  const delegate = delegateSummary(json("delegate"), json("usdc_stats"));
  const escrow = escrowSummary(json("escrow"));
  return { retrieved_at: manifest.retrieved_at, finished_at: manifest.finished_at, spec, facilitator, relayer, delegate, escrow };
}

export function nearNumbers(near) {
  const as_of = near.retrieved_at;
  const out = {};
  const add = (id, fields) => {
    out[id] = record(id, { as_of, ...fields });
  };
  const all = { all_time: true, to: near.retrieved_at };
  add("threshold.base_count_30d", {
    value: THRESHOLD.base_count_30d,
    unit: "x402 payments on Base",
    range: { days: 30, to: THRESHOLD.base_range_to },
    as_of: THRESHOLD.base_retrieved_at,
    source: "x402scan",
    definition: `x402scan total_transactions, chain base, timeframe 30, frozen in ${THRESHOLD.base_file} (sha256 ${THRESHOLD.base_file_sha256}) before the threshold was committed.`,
  });
  add("threshold.line", {
    value: near.delegate.line,
    unit: "NEAR delegate-action USDC transfers in 30 days",
    range: { days: 30, to: THRESHOLD.base_range_to },
    as_of: THRESHOLD.base_retrieved_at,
    source: "x402scan",
    definition: "The smallest whole number above 1% of the Base count. THESIS.md: N at or above this line changes my mind.",
  });
  add("near.spec.settlement_sentence", {
    value: near.spec.settlement_sentence ? 1 : 0,
    unit: "specs",
    range: { from: near.spec.first_commit_at, to: near.spec.pr_merged_at },
    source: "x402-foundation/x402",
    definition: "1 when the canonical specs/schemes/exact/scheme_exact_near.md contains the sentence that outer-transaction success is not sufficient. Merged in PR 1459.",
  });
  add("near.facilitator.discovery_total", {
    value: near.facilitator.discovery_total,
    unit: "listed resources",
    range: { at: near.retrieved_at },
    source: "x402_mikedotexe",
    definition: "pagination.total of x402.mikedotexe.com/discovery/resources, an opt-in list sellers add themselves to.",
  });
  const r = near.relayer;
  const rsrc = { range: all, source: "nearblocks_v3+near_archival_rpc" };
  add("near.relayer.receipts", { ...rsrc, value: r.receipts, unit: "receipts", definition: `NearBlocks v3 receipts for ${RELAYER}, every kind.` });
  add("near.relayer.payments", { ...rsrc, value: r.payment_count, unit: "payments", definition: `Receipts from ${RELAYER} carrying a Delegate action with one ft_transfer, each opened on archival RPC.` });
  add("near.relayer.gas_refunds", { ...rsrc, value: r.kinds.gas_refund, unit: "receipts", definition: "TRANSFER receipts from system to the relayer (gas refunds)." });
  add("near.relayer.account_setup", { ...rsrc, value: r.kinds.account_setup, unit: "receipts", definition: "CREATE_ACCOUNT or ADD_KEY receipts for the relayer." });
  add("near.relayer.funding", { ...rsrc, value: r.kinds.funding, unit: "receipts", definition: "TRANSFER receipts to the relayer from an account other than system." });
  add("near.relayer.payment_usdc_total", { ...rsrc, value: r.payment_usdc_total, unit: "USDC", definition: "Sum of ft_transfer amounts in the relayer payments, divided by 1e6." });
  add("near.relayer.payment_usdc_min", { ...rsrc, value: r.payment_usdc_min, unit: "USDC", definition: "Smallest ft_transfer amount in the relayer payments, divided by 1e6." });
  add("near.relayer.payment_usdc_max", { ...rsrc, value: r.payment_usdc_max, unit: "USDC", definition: "Largest ft_transfer amount in the relayer payments, divided by 1e6." });
  const d = near.delegate;
  const dsrc = { range: { days: 30, from: d.window.from, to: d.window.to }, source: "nearblocks_v3+near_archival_rpc" };
  add("near.delegate.sampled_receipts", { ...dsrc, value: d.counts.sampled, unit: "receipts", definition: `ft_transfer receipts on NEAR USDC sampled at ${d.points} points, ${d.per_point} newest before each.` });
  add("near.delegate.sample_successful", { ...dsrc, value: d.successful, unit: "receipts", definition: "Sampled receipts that succeeded and were classified." });
  add("near.delegate.sample_hits", { ...dsrc, value: d.counts.delegate, unit: "receipts", definition: "Sampled receipts whose transaction is a Delegate action with one ft_transfer to NEAR USDC (the x402 NEAR shape). Exact inside the sample. In the frozen sample every one of these hits is signed by 5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c. The 30-day total is not this sample." });
  add("near.delegate.transfers_30d", {
    value: d.transfers_30d.total,
    unit: "USDC transfer events",
    range: { days: 30, from: d.transfers_30d.from, to: d.transfers_30d.to },
    source: "nearblocks_v3",
    definition: "Sum of NearBlocks daily transfers_count for NEAR USDC over 30 whole UTC days. Every transfer shape, so at least as large as N.",
  });
  add("near.delegate.estimate", { ...dsrc, value: d.estimate, unit: "NEAR delegate-action USDC transfers in 30 days (estimate)", definition: "Sample share (delegate hits over successful sampled receipts) times transfers_30d. An estimate, not a count. All 30 sample points fall at 16:24 UTC, so that minute is over-weighted." });
  add("near.delegate.estimate_upper_95", { ...dsrc, value: d.estimate_upper_95, unit: "NEAR delegate-action USDC transfers in 30 days (estimate)", definition: "One-sided 95% Clopper-Pearson upper bound of the sample share times transfers_30d, assuming independent draws. The sample is 30 clusters of 15 receipts, so this is optimistic. An estimate, not a count. The sample points are all at 16:24 UTC, so that minute is over-weighted." });
  const e = near.escrow;
  const esrc = { range: { from: e.from, to: e.to, sample_txs: e.txs }, source: "nearblocks_v3+near_archival_rpc" };
  add("near.escrow.txs", { ...esrc, value: e.txs, unit: "transactions", definition: `Newest execute_intents transactions signed by ${ESCROW} at the fetch time.` });
  add("near.escrow.unique_intents", { ...esrc, value: e.unique_intents, unit: "intents", definition: "Sampled transactions after removing retries of the same intent body." });
  for (const cls of ["success", "invalid_intent", "insufficient_balance", "other"]) {
    add(`near.escrow.intents_${cls}`, { ...esrc, value: e.per_intent[cls], unit: "intents", definition: `Unique intents whose best outcome is ${cls}.` });
  }
  const known = near.known;
  if (known) {
    const krange = { days: 30, from: known.window.from, to: known.window.to };
    add("near.known.lower", {
      value: known.lower,
      unit: "NEAR delegate-action USDC transfers in 30 days",
      range: krange,
      as_of: known.retrieved_at,
      source: "fastnear_tx_api",
      definition:
        "Sum of delegate-action USDC ft_transfers signed by the accounts in facilitators.json. Accounts this survey did not name are absent, so this is a lower bound on N, not N.",
    });
    add("near.known.accounts", {
      value: known.accounts,
      unit: "relay accounts",
      range: krange,
      as_of: known.retrieved_at,
      source: "fastnear_tx_api",
      definition: "Relay accounts named in facilitators.json and counted over that window.",
    });
    const knownSrc = { range: krange, as_of: known.retrieved_at, source: "fastnear_tx_api" };
    add("near.known.named_delegate", {
      ...knownSrc,
      value: known.named_delegate,
      unit: "x402 payments",
      definition:
        "Delegate-action USDC ft_transfers signed by x402-relayer2.mike.near, x402-relayer.mike.near, solvador.near, and uvd-facilitator.near. For these named facilitators this is the x402 settlement count.",
    });
    add("near.known.uvd_signer_txs", {
      ...knownSrc,
      value: known.uvd_signer_txs,
      unit: "signer transactions",
      definition:
        "Signer transactions of uvd-facilitator.near in the window. The opened bodies are escrow calls on v1.arras-escrow.near and ft_transfer_call to NEAR USDC, not a single ft_transfer.",
    });
    add("near.known.uvd_delegate", {
      ...knownSrc,
      value: known.uvd_delegate,
      unit: "NEAR delegate-action USDC transfers in 30 days",
      definition: "Delegate-action USDC ft_transfers signed by uvd-facilitator.near. ft_transfer_call is not this count.",
    });
    add("near.known.generic_delegate", {
      ...knownSrc,
      value: known.generic_delegate,
      unit: "NEAR delegate-action USDC transfers in 30 days",
      definition:
        "Delegate-action USDC ft_transfers signed by 5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c. That account is not named by a facilitator /supported response. The transfers are not known to be x402. They are counted only as a lower bound on N.",
    });
  }
  const relays = near.relays;
  if (relays && !relays.pending) {
    const rrange = { days: 30, from: relays.window.from, to: relays.window.to };
    const rsource = "nearblocks_v3+near_archival_rpc";
    add("near.relays.accounts", {
      value: relays.accounts.length,
      unit: "relayer accounts",
      range: rrange,
      source: rsource,
      definition: "Relayer accounts walked for the 30-day count: the frozen 16:24 UTC sample, x402-relayer2.mike.near, and signers from the time-scattered sample.",
    });
    add("near.relays.lower", {
      value: relays.lower,
      unit: "NEAR delegate-action USDC transfers in 30 days",
      range: rrange,
      source: rsource,
      definition: "Sum of each found relayer's delegate-action USDC ft_transfers over the window. Relayers the sample missed are absent, so this is a lower bound on N.",
    });
    add("near.relays.upper", {
      value: relays.upper,
      unit: "NEAR delegate-action USDC transfers in 30 days (estimate)",
      range: rrange,
      source: rsource,
      definition: "The existing 95% estimate upper bound. Kept as the upper bound. The sample behind it is biased to 16:24 UTC.",
    });
  }
  return out;
}

async function readOptionalCensus(dir, manifest) {
  const entry = manifest.files?.[CENSUS_FILE];
  if (!entry) return null;
  const text = await readFile(join(dir, CENSUS_FILE), "utf8");
  const got = sha256(text);
  if (got !== entry.sha256) throw new Error(`near snapshot ${CENSUS_FILE} sha256 mismatch: got ${got}, want ${entry.sha256}`);
  return summarizeCensus(JSON.parse(text));
}

const KNOWN_READING = {
  not_decided: "not decided",
  crossed: "crossed",
  not_crossed: "not crossed",
};

// Each public facilitator names only its own signer. The roster is the whole set in one list.
export function facilitatorRoster(accounts) {
  return (accounts ?? []).map((account) => {
    let note = "Named facilitator.";
    if (account.kind === "sample_signer") {
      note =
        "Not named by /supported. Generic relay. Delegate USDC transfers are not known to be x402, and are counted only as a lower bound on N.";
    } else if (account.account === "uvd-facilitator.near") {
      note = "Escrow movements, not a Delegate USDC ft_transfer.";
    } else if (account.kind === "provisioned_relayer") {
      note = "Provisioned mainnet relayer. Not the live signer.";
    } else if ((account.signer_txs ?? 0) === 0) {
      note = "No signer transaction in the window.";
    }
    return {
      account: account.account,
      kind: account.kind,
      named_in_supported: account.kind === "facilitator_signer",
      signer_txs: account.signer_txs ?? 0,
      delegate_usdc: account.delegate_usdc ?? 0,
      note,
    };
  });
}

export async function loadNear(dir) {
  const { manifest, texts } = await verifyNearSnapshot(dir);
  const near = nearFromTexts(manifest, texts);
  const known = await loadFacilitators(dir);
  if (known) {
    const namedAccounts = known.accounts.filter((account) => account.kind !== "sample_signer");
    const generic = known.accounts.find((account) => account.kind === "sample_signer");
    const uvd = known.accounts.find((account) => account.account === "uvd-facilitator.near");
    near.known = {
      lower: known.lower,
      result: known.result,
      reading: KNOWN_READING[known.result] ?? known.result,
      line: known.line,
      accounts: known.accounts.length,
      rows: known.accounts.map((account) => `${account.account} ${account.delegate_usdc}`),
      named_delegate: namedAccounts.reduce((sum, account) => sum + account.delegate_usdc, 0),
      generic_delegate: generic?.delegate_usdc ?? 0,
      uvd_signer_txs: uvd?.signer_txs ?? 0,
      uvd_delegate: uvd?.delegate_usdc ?? 0,
      roster: facilitatorRoster(known.accounts),
      window: { from: known.window.from, to: known.window.to },
      retrieved_at: known.retrieved_at,
      sha256: known.sha256,
      list_complete: known.list_complete === true,
    };
  }
  const census = await readOptionalCensus(dir, manifest);
  if (!census) {
    near.relays = { pending: true };
    return { near, numbers: nearNumbers(near), limits: manifest.limits ?? {}, relaysPending: true };
  }
  near.relays = census;
  return {
    near,
    numbers: nearNumbers(near),
    limits: manifest.limits ?? {},
    relaysPending: census.list_complete !== true,
  };
}

// Refresh only the relayer census. The other frozen NEAR files stay as they are.
export async function fetchRelayCensus(dir, { log = () => {}, pauseMs = 8000, fetchImpl, points, perPoint } = {}) {
  const sample = JSON.parse(await readFile(join(dir, FILES.delegate), "utf8"));
  const stats = JSON.parse(await readFile(join(dir, FILES.usdc_stats), "utf8"));
  const summary = delegateSummary(sample, stats);
  const client = makeNearblocks({ fetchImpl, pauseMs, log });
  const census = await buildRelayCensus({
    get: client.get,
    rpc: client.rpc,
    window: sample.window,
    upper: summary.estimate_upper_95,
    estimate: summary.estimate,
    line: summary.line,
    extraSigners: [...signersFromFrozenSample(sample), RELAYER],
    log,
    progressPath: join(dir, PROGRESS_FILE),
    ...(points == null ? {} : { points }),
    ...(perPoint == null ? {} : { perPoint }),
  });
  const text = `${JSON.stringify(census, null, 2)}\n`;
  await writeFile(join(dir, CENSUS_FILE), text);
  const manifest = JSON.parse(await readFile(join(dir, MANIFEST), "utf8"));
  manifest.files[CENSUS_FILE] = {
    sha256: sha256(text),
    source:
      "v3 /accounts/{id}/txns for x402-relayer2.mike.near, the frozen delegate-sample signers, and signers from a time-scattered USDC ft_transfer sample. Each candidate opened on archival RPC tx, or v3 /txns/{hash}/receipts if that call failed.",
  };
  manifest.limits = { ...(manifest.limits ?? {}), relays: RELAY_LIMITS };
  await writeFile(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return census;
}

// ---------- fetch (only with --fetch-near) ----------

export function makeClients({
  fetchImpl = fetch,
  nearblocksPauseMs = 6000,
  rpcPauseMs = 400,
  rpcUrls = ARCHIVAL_RPCS,
  log = () => {},
} = {}) {
  let lastNb = 0;
  async function get(url, { nearblocks = false } = {}) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (nearblocks) {
        const wait = lastNb + nearblocksPauseMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastNb = Date.now();
      }
      let res;
      try {
        res = await fetchImpl(url, {
          headers: { "user-agent": USER_AGENT, accept: "application/json, text/markdown, */*" },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        log(`retry ${url}: ${err.message}`);
        await sleep(nearblocks ? 30_000 : 3_000);
        continue;
      }
      if (res.ok) return res.text();
      if (res.status === 429 || res.status >= 500) {
        log(`retry ${url}: HTTP ${res.status}`);
        await sleep(nearblocks ? 30_000 : 3_000);
        continue;
      }
      throw new Error(`${url} HTTP ${res.status}`);
    }
    throw new Error(`${url} failed after retries`);
  }
  // Public archival RPCs limit callers without a key, so calls are spaced out and a 429 moves to the next one.
  let turn = 0;
  async function rpc(method, params) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const url = rpcUrls[turn % rpcUrls.length];
      turn += 1;
      await sleep(rpcPauseMs);
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": USER_AGENT },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (body.error) return { error: JSON.stringify(body.error).slice(0, 300) };
        return { result: body.result };
      } catch (err) {
        log(`rpc retry ${method} ${url}: ${err.message}`);
        await sleep(3_000 * (attempt + 1));
      }
    }
    return { error: "rpc failed after retries" };
  }
  return { get, rpc };
}

function trimReceiptRow(row) {
  return {
    receipt_id: row.receipt_id,
    transaction_hash: row.transaction_hash,
    predecessor_account_id: row.predecessor_account_id,
    receiver_account_id: row.receiver_account_id,
    actions: (row.actions ?? []).map((a) => ({ action: a.action, method: a.method ?? null })),
    outcome_status: row.outcome?.status ?? null,
    block_timestamp: row.block?.block_timestamp ?? row.included_in_block_timestamp,
  };
}

function summarizeTxActions(actions) {
  return (actions ?? []).map((a) => {
    if (a.Delegate) {
      const d = a.Delegate.delegate_action;
      return {
        type: "Delegate",
        sender_id: d.sender_id,
        receiver_id: d.receiver_id,
        inner: (d.actions ?? []).map((x) =>
          x.FunctionCall ? { type: "FunctionCall", method_name: x.FunctionCall.method_name } : { type: Object.keys(x)[0] ?? String(x) },
        ),
      };
    }
    if (a.FunctionCall) return { type: "FunctionCall", method_name: a.FunctionCall.method_name };
    return { type: typeof a === "string" ? a : Object.keys(a)[0] };
  });
}

async function pagesOf(get, url, maxPages) {
  const rows = [];
  const pages = [];
  let next = null;
  for (let i = 0; i < maxPages; i += 1) {
    const pageUrl = next ? `${url}&next=${encodeURIComponent(next)}` : url;
    const body = JSON.parse(await get(pageUrl, { nearblocks: true }));
    pages.push(pageUrl);
    rows.push(...(body.data ?? []));
    next = body.meta?.next_page ?? null;
    if (!next) break;
  }
  return { rows, pages, complete: next == null };
}

export async function fetchNear(dir, { now = Date.now(), points = 30, perPoint = 15, escrowTxs = 100, clients, log = () => {} } = {}) {
  const { get, rpc } = clients ?? makeClients({ log });
  const retrieved_at = new Date(now).toISOString();
  const out = {};
  const sources = {};

  log("spec, facilitator, mpp");
  out.spec = await get(URLS.spec);
  sources.spec = URLS.spec;
  out.spec_commits = await get(URLS.spec_commits);
  sources.spec_commits = URLS.spec_commits;
  out.spec_pr = await get(URLS.spec_pr);
  sources.spec_pr = URLS.spec_pr;
  out.supported = await get(URLS.supported);
  sources.supported = URLS.supported;
  out.discovery = await get(URLS.discovery);
  sources.discovery = URLS.discovery;
  out.mpp = await get(URLS.mpp);
  sources.mpp = URLS.mpp;

  log("relayer");
  const relayer = await pagesOf(get, URLS.relayer_receipts, 20);
  if (!relayer.complete) throw new Error("relayer receipts did not end within 20 pages");
  out.relayer = `${JSON.stringify({ account: RELAYER, pages: relayer.pages, rows: relayer.rows }, null, 2)}\n`;
  sources.relayer = URLS.relayer_receipts;
  const payments = [];
  for (const row of relayer.rows.filter((r) => relayerKind(r) === "payment")) {
    const res = await rpc("tx", { tx_hash: row.transaction_hash, sender_account_id: RELAYER, wait_until: "NONE" });
    const p = res.result ? paymentFromTx(res.result) : null;
    payments.push(p ?? { hash: row.transaction_hash, error: res.error ?? "no Delegate action" });
  }
  out.relayer_payments = `${JSON.stringify({ rpc: ARCHIVAL_RPCS, method: "tx", payments }, null, 2)}\n`;
  sources.relayer_payments = `NEAR archival RPC tx(tx_hash, sender_account_id=${RELAYER})`;

  log("usdc transfer stats");
  out.usdc_stats = await get(URLS.usdc_stats, { nearblocks: true });
  sources.usdc_stats = URLS.usdc_stats;

  log(`delegate sample: ${points} points x ${perPoint}`);
  const windowFrom = now - 30 * DAY_MS;
  const step = (30 * DAY_MS) / points;
  const samplePoints = [];
  for (let i = 0; i < points; i += 1) {
    const at = windowFrom + (i + 0.5) * step;
    const url = `${URLS.usdc_receipts}&before_ts=${nsFromMs(at)}&limit=${perPoint}`;
    const body = JSON.parse(await get(url, { nearblocks: true }));
    samplePoints.push({ before: new Date(at).toISOString(), url, rows: (body.data ?? []).map(trimReceiptRow) });
  }
  const receipts = {};
  const txs = {};
  let opened = 0;
  for (const point of samplePoints) {
    for (const row of point.rows) {
      if (row.outcome_status !== true) continue;
      if (!(row.actions.length === 1 && row.actions[0].action === "FUNCTION_CALL" && row.actions[0].method === "ft_transfer")) continue;
      if (receipts[row.receipt_id]) continue;
      const rc = await rpc("EXPERIMENTAL_receipt", { receipt_id: row.receipt_id });
      opened += 1;
      if (opened % 100 === 0) log(`opened ${opened} receipts`);
      if (rc.error) {
        receipts[row.receipt_id] = { error: rc.error };
        continue;
      }
      const signer_id = rc.result?.receipt?.Action?.signer_id ?? null;
      receipts[row.receipt_id] = { predecessor_id: rc.result?.predecessor_id ?? null, signer_id };
      if (signer_id && signer_id !== rc.result?.predecessor_id && !txs[row.transaction_hash]) {
        const t = await rpc("tx", { tx_hash: row.transaction_hash, sender_account_id: signer_id, wait_until: "NONE" });
        txs[row.transaction_hash] = t.error
          ? { error: t.error }
          : { signer_id: t.result.transaction.signer_id, receiver_id: t.result.transaction.receiver_id, actions: summarizeTxActions(t.result.transaction.actions) };
      }
    }
  }
  out.delegate = `${JSON.stringify(
    {
      window: { from: new Date(windowFrom).toISOString(), to: retrieved_at },
      per_point: perPoint,
      rpc: ARCHIVAL_RPCS,
      points: samplePoints,
      receipts,
      txs,
    },
    null,
    2,
  )}\n`;
  sources.delegate = `${URLS.usdc_receipts}&before_ts=<point>&limit=${perPoint} at ${points} points, then NEAR archival RPC EXPERIMENTAL_receipt and tx`;

  log("escrow");
  const esc = JSON.parse(await get(URLS.escrow_txns, { nearblocks: true }));
  const escRows = (esc.data ?? [])
    .filter((t) => t.signer_account_id === ESCROW && (t.actions ?? []).some((a) => a.method === "execute_intents"))
    .slice(0, escrowTxs);
  const escrowList = [];
  for (const t of escRows) {
    const res = await rpc("EXPERIMENTAL_tx_status", { tx_hash: t.transaction_hash, sender_account_id: ESCROW, wait_until: "NONE" });
    if (res.error) {
      escrowList.push({ hash: t.transaction_hash, at: isoFromNs(t.block_timestamp), error: res.error });
      continue;
    }
    const tx = res.result.transaction;
    const call = tx.actions?.[0]?.FunctionCall;
    const args = call ? decodeArgs(call.args) : null;
    const execute = (res.result.receipts_outcome ?? []).find((o) => o.outcome.executor_id === INTENTS);
    const intent_hashes = [];
    for (const line of execute?.outcome?.logs ?? []) {
      if (!line.startsWith("EVENT_JSON:")) continue;
      try {
        const ev = JSON.parse(line.slice("EVENT_JSON:".length));
        for (const item of ev.data ?? []) if (item.intent_hash) intent_hashes.push(item.intent_hash);
      } catch {
        // a log line that is not JSON is skipped
      }
    }
    escrowList.push({
      hash: t.transaction_hash,
      at: isoFromNs(t.block_timestamp),
      receiver_id: tx.receiver_id,
      args,
      execute: execute ? { status: execute.outcome.status, intent_hashes: [...new Set(intent_hashes)] } : null,
    });
  }
  out.escrow = `${JSON.stringify({ account: ESCROW, list: URLS.escrow_txns, rpc: ARCHIVAL_RPCS, txs: escrowList }, null, 2)}\n`;
  sources.escrow = `${URLS.escrow_txns}, then NEAR archival RPC EXPERIMENTAL_tx_status`;

  await mkdir(dir, { recursive: true });
  const files = {};
  for (const [key, name] of Object.entries(FILES)) {
    await writeFile(join(dir, name), out[key]);
    files[name] = { sha256: sha256(out[key]), source: sources[key] };
  }
  const manifest = {
    retrieved_at,
    finished_at: new Date().toISOString(),
    note: "Every file below is read by `node thesis.mjs --offline`, which stops if a sha256 differs.",
    files,
    limits: { delegate: DELEGATE_LIMITS, escrow: ESCROW_LIMITS },
  };
  await writeFile(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
