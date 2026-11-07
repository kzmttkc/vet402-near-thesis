// Counts delegate-action NEAR USDC ft_transfers for the known relay accounts.
// Public reads only: POST https://tx.main.fastnear.com/v0/account and /v0/transactions.
// No key, no account, no mainnet write. Resume file stays in /tmp.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NEAR_USDC } from "../lib/sources/relay-census.mjs";
import {
  countSignerTxs,
  facilitatorsDocument,
  listSignerTxs,
  makeFastnear,
  windowFromTip,
  writeFacilitators,
} from "../lib/sources/fastnear-census.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "snapshot", "near");
const PROGRESS = "/tmp/vet402-facilitators-progress.json";
const SAMPLE_SIGNER = "5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c";
const KNOWN_HIT = "76hZkqNNi359kH266MTbce7ko9nvcqwMaWjtw92Azc4b";

const ACCOUNTS = [
  {
    account: "x402-relayer2.mike.near",
    kind: "facilitator_signer",
    sources: [
      "https://x402.mikedotexe.com/supported (signers.near:mainnet, scheme exact, retrieved 2026-11-07)",
      "https://github.com/fastnear/x402-facilitator/blob/main/README.md (near:mainnet reference facilitator is that host)",
      "https://github.com/fastnear/x402-facilitator/blob/main/deploy/config/mainnet.json.example (relayer_account_id)",
      "https://github.com/x402-foundation/x402/blob/main/docs/dev-tools/facilitators.md (NEAR x402 Facilitator)",
    ],
  },
  {
    account: "x402-relayer.mike.near",
    kind: "provisioned_relayer",
    sources: [
      "https://github.com/fastnear/x402-facilitator/blob/main/docs/evidence/2026-07-19-relayer-provisioning.md (mainnet account created; that note says the service was not shown live)",
    ],
  },
  {
    account: "solvador.near",
    kind: "facilitator_signer",
    sources: [
      "https://github.com/x402-foundation/x402/blob/main/docs/dev-tools/facilitators.md (Solvador, NEAR named)",
      "https://api.solvador.com/supported (signers['near:*'] is solvador.near; kind exact on near:mainnet, retrieved 2026-11-07)",
      "https://docs.solvador.com/networks/ (NEAR exact is a relayer-sponsored NEP-366 delegate)",
    ],
  },
  {
    account: "uvd-facilitator.near",
    kind: "facilitator_signer",
    sources: [
      "https://facilitator.ultravioletadao.xyz/supported (v2 exact near:mainnet extra.feePayer, retrieved 2026-11-07; not a row in the foundation facilitators table; the same host also advertises an escrow scheme, which this count leaves out)",
    ],
  },
  {
    account: SAMPLE_SIGNER,
    kind: "sample_signer",
    sources: [
      "data/snapshot/near/usdc-delegate-sample.json (signer_id of every frozen delegate-shaped hit, including 76hZkqNNi359kH266MTbce7ko9nvcqwMaWjtw92Azc4b). Not named by a facilitator /supported response.",
    ],
  },
];

function log(line) {
  console.error(`facilitators: ${line}`);
}

async function readProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS, "utf8"));
  } catch {
    return null;
  }
}

export async function fetchKnownRelays(dir = OUT_DIR, { log: logImpl = log } = {}) {
  const say = logImpl;
  const client = makeFastnear({ log: say, pauseMs: 80 });
  const saved = await readProgress();
  const window = saved?.window ?? (await windowFromTip(client.post));
  say(`窓 ${window.from} .. ${window.to} 高さ ${window.from_height}..${window.to_height}`);
  const order = await client.post("/v0/transactions", { tx_hashes: [KNOWN_HIT] });
  const opened = order.transactions?.[0]?.transaction?.signer_id;
  if (opened !== SAMPLE_SIGNER) throw new Error(`sample tx signer ${opened}`);
  const accounts = saved?.accounts ?? [];
  const finished = new Set(accounts.map((row) => row.account));
  for (const spec of ACCOUNTS) {
    if (finished.has(spec.account)) continue;
    const open = saved?.open?.account === spec.account ? saved.open : null;
    const listed = open?.listed ?? (await listSignerTxs(client.post, spec.account, window, { log: say }));
    say(`${spec.account} 署名取引 ${listed.rows.length} 申告 ${listed.reported} 完全 ${listed.list_complete}`);
    const done = new Set(open?.done ?? []);
    const priorCounted = open?.counted ?? [];
    const priorRejected = open?.rejected ?? { no_usdc_ft: 0, not_single: 0, inner_failed: 0, unchecked: 0 };
    const fresh = await countSignerTxs(client.post, spec.account, listed, {
      log: say,
      done,
      onProgress: async ({ done: doneNow, counted, rejected }) => {
        const merged = mergeRejected(priorRejected, rejected);
        await writeFile(
          PROGRESS,
          JSON.stringify({
            window,
            accounts,
            open: {
              account: spec.account,
              listed,
              done: doneNow,
              counted: priorCounted.concat(counted),
              rejected: merged,
            },
          }),
        );
      },
    });
    const rejected = mergeRejected(priorRejected, fresh.rejected);
    const counted = priorCounted.concat(fresh.counted);
    counted.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.hash < b.hash ? -1 : 1));
    const row = {
      account: spec.account,
      kind: spec.kind,
      sources: spec.sources,
      signer_txs: listed.rows.length,
      signer_txs_reported: listed.reported,
      list_complete: listed.list_complete,
      opened: fresh.opened,
      delegate_usdc: counted.length,
      rejected,
      unchecked: rejected.unchecked ?? 0,
      first_at: counted[0]?.at ?? null,
      last_at: counted.at(-1)?.at ?? null,
      sample_hashes: counted.slice(0, 3).map((item) => item.hash),
      includes_frozen_hit: spec.account === SAMPLE_SIGNER ? counted.some((item) => item.hash === KNOWN_HIT) : null,
    };
    accounts.push(row);
    await writeFile(PROGRESS, JSON.stringify({ window, accounts }));
    say(`${spec.account} 該当 ${row.delegate_usdc}`);
  }
  const estimate = 20421;
  const biased_sample_estimate = 42675;
  const doc = facilitatorsDocument({
    window: {
      days: window.days,
      from: window.from,
      to: window.to,
      from_height: window.from_height,
      to_height: window.to_height,
      from_ns: window.from_ns,
      to_ns: window.to_ns,
      target_ns: window.target_ns,
    },
    accounts,
    retrieved_at: new Date().toISOString(),
    biased_sample_estimate,
    estimate,
  });
  doc.surveyed_without_near_exact_signer = [
    "https://x402.org/facilitator/supported (no near network, retrieved 2026-11-07)",
    "https://facilitator.payai.network/supported (no near kind, retrieved 2026-11-07)",
  ];
  doc.token = NEAR_USDC;
  await mkdir(dir, { recursive: true });
  const stamped = await writeFacilitators(dir, doc);
  say(`下限 ${stamped.lower} 判定 ${stamped.result} sha256 ${stamped.sha256}`);
  return stamped;
}

function mergeRejected(a, b) {
  const out = { no_usdc_ft: 0, not_single: 0, inner_failed: 0, unchecked: 0 };
  for (const key of Object.keys(out)) out[key] = (a?.[key] ?? 0) + (b?.[key] ?? 0);
  return out;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked || import.meta.url === pathToFileURL(invoked).href) {
  fetchKnownRelays(OUT_DIR).catch((err) => {
    console.error(err.stack ?? err.message ?? err);
    process.exit(1);
  });
}
