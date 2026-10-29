import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getText } from "../http.mjs";
import { record } from "../numbers.mjs";

// The query without a chain (the total) is saved as all.json.
export const X402_CHAINS = ["all", "base", "solana", "polygon", "optimism"];

export function x402Url(chain) {
  const json = { timeframe: 30 };
  if (chain && chain !== "all") json.chain = chain;
  const input = encodeURIComponent(JSON.stringify({ json }));
  return `https://www.x402scan.com/api/trpc/public.stats.overall?input=${input}`;
}

export function parseOverall(body) {
  const parsed = typeof body === "string" ? JSON.parse(body) : body;
  const inner = parsed?.result?.data?.json;
  if (inner == null || inner.total_amount == null || inner.total_transactions == null) {
    throw new Error("x402scan response missing total_amount or total_transactions");
  }
  return inner;
}

export function x402Numbers(byChain, as_of) {
  const all = parseOverall(byChain.all);
  const base = parseOverall(byChain.base);
  if (!all.latest_block_timestamp) {
    throw new Error("x402scan latest_block_timestamp missing");
  }
  const totalUsd = Number(all.total_amount) / 1e6;
  const baseUsd = Number(base.total_amount) / 1e6;
  const totalCount = Number(all.total_transactions);
  const baseCount = Number(base.total_transactions);
  if (!(totalUsd > 0) || !(totalCount > 0)) {
    throw new Error("x402scan overall total is 0");
  }
  const range = { days: 30, to: all.latest_block_timestamp };
  const source = "x402scan";
  return {
    "x402.total.amount_30d": record("x402.total.amount_30d", {
      value: totalUsd,
      unit: "USD",
      range,
      as_of,
      source,
      definition:
        "x402scan total_amount for 30 days with no chain filter, divided by 1e6 into USD.",
    }),
    "x402.base.share_amount_30d": record("x402.base.share_amount_30d", {
      value: baseUsd / totalUsd,
      unit: "share of USD",
      range,
      as_of,
      source,
      definition: "Base total_amount divided by the no-chain total_amount.",
    }),
    "x402.base.share_count_30d": record("x402.base.share_count_30d", {
      value: baseCount / totalCount,
      unit: "share of count",
      range,
      as_of,
      source,
      definition: "Base total_transactions divided by the no-chain total_transactions.",
    }),
  };
}

export async function loadX402({ dir, metaPath, offline, fetchImpl }) {
  if (!offline) {
    await mkdir(dir, { recursive: true });
    for (const chain of X402_CHAINS) {
      const text = await getText(x402Url(chain), fetchImpl);
      await writeFile(join(dir, `${chain}.json`), text);
    }
    await writeFile(
      metaPath,
      `${JSON.stringify({ retrieved_at: new Date().toISOString() }, null, 2)}\n`,
    );
  }
  const as_of = JSON.parse(await readFile(metaPath, "utf8")).retrieved_at;
  const byChain = {};
  for (const chain of X402_CHAINS) {
    byChain[chain] = JSON.parse(await readFile(join(dir, `${chain}.json`), "utf8"));
  }
  return x402Numbers(byChain, as_of);
}
