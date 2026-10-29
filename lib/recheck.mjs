import { createHash } from "node:crypto";
import { USER_AGENT } from "./http.mjs";
import { DEFAULT_RPCS, TOPIC_TRANSFER, USDC } from "./sources/vault.mjs";

export { TOPIC_TRANSFER, USDC };
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const BASE_NETWORK = "eip155:8453";

const COUNT_KEYS = ["checked", "match", "mismatch", "not_rechecked"];

function sha256Hex(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function pause(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function selectSample(rows, { limit = 100 } = {}) {
  const grouped = { base: [], solana: [] };
  rows.forEach((row, index) => {
    if (row?.status !== "settled") return;
    const tx = row.tx_hash || "";
    if (!tx) return;
    const network = row.network || "";
    const item = { tx, index, hash: sha256Hex(tx) };
    if (network === BASE_NETWORK) grouped.base.push(item);
    else if (network.startsWith("solana:")) grouped.solana.push(item);
  });
  const byHash = (a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : a.index - b.index);
  const cap = limit == null || limit === Infinity ? Infinity : limit;
  const take = (list) => list.sort(byHash).slice(0, cap).map((item) => item.tx);
  return { base: take(grouped.base), solana: take(grouped.solana) };
}

// With expectedUnits, a match also needs a USDC Transfer of exactly the purchase amount.
export function judgeBaseReceipt(receipt, expectedUnits) {
  if (receipt == null || typeof receipt !== "object") return "mismatch";
  let statusOk = false;
  try {
    statusOk = BigInt(receipt.status) === 1n;
  } catch {
    statusOk = false;
  }
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transfer = logs.some((log) => {
    const address = String(log?.address ?? "").toLowerCase();
    const topic = String(log?.topics?.[0] ?? "").toLowerCase();
    if (address !== USDC.toLowerCase() || topic !== TOPIC_TRANSFER.toLowerCase()) return false;
    if (expectedUnits == null || expectedUnits === "") return true;
    try {
      return BigInt(log.data) === BigInt(expectedUnits);
    } catch {
      return false;
    }
  });
  return statusOk && transfer ? "match" : "mismatch";
}

export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// With expectedUnits, a match also needs one USDC account that grew by exactly the purchase amount.
export function judgeSolanaTx(result, expectedUnits) {
  if (result == null || typeof result !== "object") return "mismatch";
  if (result.meta == null || typeof result.meta !== "object") return "mismatch";
  if (!Object.prototype.hasOwnProperty.call(result.meta, "err")) return "mismatch";
  if (result.meta.err !== null) return "mismatch";
  if (expectedUnits == null || expectedUnits === "") return "match";
  const usdc = (list) =>
    new Map(
      (Array.isArray(list) ? list : [])
        .filter((b) => b?.mint === SOLANA_USDC_MINT)
        .map((b) => [b.accountIndex, BigInt(b?.uiTokenAmount?.amount ?? "0")]),
    );
  const pre = usdc(result.meta.preTokenBalances);
  const post = usdc(result.meta.postTokenBalances);
  let want;
  try {
    want = BigInt(expectedUnits);
  } catch {
    return "mismatch";
  }
  for (const [index, after] of post) {
    if (after - (pre.get(index) ?? 0n) === want) return "match";
  }
  return "mismatch";
}

function tally(outcomes) {
  const out = { checked: 0, match: 0, mismatch: 0, not_rechecked: 0 };
  for (const outcome of outcomes) {
    if (outcome === "match") {
      out.match += 1;
      out.checked += 1;
    } else if (outcome === "mismatch") {
      out.mismatch += 1;
      out.checked += 1;
    } else {
      out.not_rechecked += 1;
    }
  }
  return out;
}

async function rpcOnce(url, method, params, fetchImpl, timeoutMs) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const refused = new Error(err?.message ?? "rpc failed");
    refused.refused = true;
    throw refused;
  }
  if (!res?.ok) {
    const refused = new Error(`HTTP ${res?.status ?? "error"}`);
    refused.refused = true;
    throw refused;
  }
  let body;
  try {
    body = await res.json();
  } catch {
    const refused = new Error("rpc body is not json");
    refused.refused = true;
    throw refused;
  }
  if (body?.error) {
    const refused = new Error("rpc error");
    refused.refused = true;
    throw refused;
  }
  return body?.result;
}

async function rpcCall(url, method, params, fetchImpl, options) {
  let last;
  for (let attempt = 0; attempt < options.retries; attempt += 1) {
    try {
      return await rpcOnce(url, method, params, fetchImpl, options.timeoutMs);
    } catch (err) {
      last = err;
      if (attempt + 1 < options.retries) await pause(options.pauseMs * (attempt + 1));
    }
  }
  throw last;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  if (items.length === 0) return results;
  let next = 0;
  const workers = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

async function checkBase(tx, fetchImpl, rpcs, options, expectedUnits) {
  let last;
  for (const url of rpcs) {
    try {
      const receipt = await rpcCall(url, "eth_getTransactionReceipt", [tx], fetchImpl, options);
      return judgeBaseReceipt(receipt, expectedUnits);
    } catch (err) {
      last = err;
    }
  }
  void last;
  return "not_rechecked";
}

async function checkSolana(tx, fetchImpl, url, options, expectedUnits) {
  try {
    const result = await rpcCall(
      url,
      "getTransaction",
      [tx, { encoding: "json", maxSupportedTransactionVersion: 0 }],
      fetchImpl,
      options,
    );
    return judgeSolanaTx(result, expectedUnits);
  } catch {
    return "not_rechecked";
  }
}

export async function recheckRows(rows, options = {}) {
  const limit = options.all ? Infinity : (options.limit ?? 100);
  const sample = selectSample(rows, { limit });
  const units = new Map();
  for (const row of rows) if (row?.tx_hash && !units.has(row.tx_hash)) units.set(row.tx_hash, row.spent_units || null);
  const checkAmount = options.checkAmount ?? true;
  const unitsFor = (tx) => (checkAmount ? units.get(tx) : null);
  const fetchImpl = options.fetchImpl ?? fetch;
  const rpcs = options.baseRpcs ?? DEFAULT_RPCS;
  const solanaRpc = options.solanaRpc ?? SOLANA_RPC;
  const callOptions = {
    retries: options.retries ?? 2,
    pauseMs: options.pauseMs ?? 200,
    timeoutMs: options.timeoutMs ?? 12_000,
  };
  const gapMs = options.gapMs ?? 40;
  const baseOutcomes = await mapPool(sample.base, options.baseConcurrency ?? 4, async (tx) => {
    const outcome = await checkBase(tx, fetchImpl, rpcs, callOptions, unitsFor(tx));
    await pause(gapMs);
    return outcome;
  });
  // The public Solana RPC rate-limits hard (90 of 100 refused at 2 in parallel on 2026-10-30),
  // so Solana goes one at a time with longer pauses.
  const solanaCallOptions = {
    ...callOptions,
    retries: options.solanaRetries ?? 4,
    pauseMs: options.solanaPauseMs ?? 2500,
  };
  const solanaOutcomes = await mapPool(sample.solana, options.solanaConcurrency ?? 1, async (tx) => {
    const outcome = await checkSolana(tx, fetchImpl, solanaRpc, solanaCallOptions, unitsFor(tx));
    await pause(options.solanaGapMs ?? 1200);
    return outcome;
  });
  return {
    base: {
      ...tally(baseOutcomes),
      outcomes: sample.base.map((tx, index) => ({ tx, result: baseOutcomes[index] })),
    },
    solana: {
      ...tally(solanaOutcomes),
      outcomes: sample.solana.map((tx, index) => ({ tx, result: solanaOutcomes[index] })),
    },
    other: "not re-checked",
  };
}

export function summaryFromFile(data) {
  if (data == null || typeof data !== "object") throw new Error("recheck.json is not an object");
  const pick = (side, name) => {
    if (side == null || typeof side !== "object") throw new Error(`recheck.json missing ${name}`);
    const out = {};
    for (const key of COUNT_KEYS) {
      if (!Number.isInteger(side[key]) || side[key] < 0) {
        throw new Error(`recheck.json ${name}.${key} is not an integer`);
      }
      out[key] = side[key];
    }
    return out;
  };
  return {
    base: pick(data.base, "base"),
    solana: pick(data.solana, "solana"),
    other: "not re-checked",
  };
}
