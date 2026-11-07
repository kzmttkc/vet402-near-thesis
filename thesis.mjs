import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summarize } from "./lib/classify.mjs";
import { parseCsv, stringifyCsv } from "./lib/csv.mjs";
import { DEFINITIONS } from "./lib/definitions.mjs";
import { deriveRows } from "./lib/derive.mjs";
import { USER_AGENT } from "./lib/http.mjs";
import { buildModel, readModelInputs } from "./lib/model.mjs";
import { record } from "./lib/numbers.mjs";
import { readQuotes } from "./lib/quotes.mjs";
import { loadDefillama } from "./lib/sources/defillama.mjs";
import { loadVaultNumbers, fetchVaultLogs, writeVault, DEFAULT_RPCS } from "./lib/sources/vault.mjs";
import { loadX402 } from "./lib/sources/x402scan.mjs";
import { fetchKnownRelays } from "./online/fetch-facilitators.mjs";
import { fetchNear, loadNear, MANIFEST as NEAR_MANIFEST } from "./lib/sources/near.mjs";
import { recheckRows, summaryFromFile } from "./lib/recheck.mjs";
import { renderTemplate } from "./lib/render.mjs";
import { checkSurfaces } from "./lib/surface.mjs";
import { checkQuotes } from "./lib/quotecheck.mjs";

export { USER_AGENT };
export const EXPORT_URL = "https://vet402.com/api/v1/observatory/export.csv?days=365";

const ROOT = dirname(fileURLToPath(import.meta.url));

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function parseArgs(argv) {
  const offline = argv.includes("--offline");
  const fetchVault = argv.includes("--fetch-vault");
  const fetchNearFlag = argv.includes("--fetch-near");
  const fetchRelaysFlag = argv.includes("--fetch-relays");
  const snapIdx = argv.indexOf("--snapshot");
  const snapshotDir = snapIdx >= 0 ? argv[snapIdx + 1] : join("data", "snapshot");
  const thesisIdx = argv.indexOf("--thesis");
  const fromIdx = argv.indexOf("--from-block");
  const toIdx = argv.indexOf("--to-block");
  const checkIdx = argv.indexOf("--check");
  let checkFiles = null;
  if (checkIdx >= 0) {
    checkFiles = [];
    for (let i = checkIdx + 1; i < argv.length; i += 1) {
      if (argv[i].startsWith("--")) break;
      checkFiles.push(argv[i]);
    }
  }
  const renderIdx = argv.indexOf("--render");
  let renderPairs = null;
  if (renderIdx >= 0) {
    renderPairs = [];
    for (let i = renderIdx + 1; i < argv.length; i += 1) {
      if (argv[i].startsWith("--")) break;
      renderPairs.push(argv[i]);
    }
    if (renderPairs.length === 0) renderPairs.push("README.tmpl.md:README.md");
  }
  const vaultRpcs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--vault-rpc" && argv[i + 1]) vaultRpcs.push(argv[i + 1]);
  }
  return {
    offline,
    fetchVault,
    fetchNear: fetchNearFlag,
    fetchRelays: fetchRelaysFlag,
    snapshotDir,
    thesisPath: thesisIdx >= 0 ? argv[thesisIdx + 1] : null,
    fromBlock: fromIdx >= 0 ? Number(argv[fromIdx + 1]) : null,
    toBlock: toIdx >= 0 ? Number(argv[toIdx + 1]) : null,
    checkFiles,
    renderPairs,
    recheck: argv.includes("--recheck"),
    checkQuotes: argv.includes("--check-quotes"),
    recheckAll: argv.includes("--all"),
    vaultRpcs,
  };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchExport(rawPath) {
  const res = await fetch(EXPORT_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`export fetch failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, buf);
  return buf;
}

function buildThesis({ summary, snapshot, generated_at, extraNumbers = {}, model = null, quotes = [] }) {
  const { counts, breakdown, checks, range } = summary;
  const as_of = snapshot.export_retrieved_at;
  const source = "vet402_export";
  const numbers = {
    "vet402.rows": record("vet402.rows", {
      value: counts.rows,
      unit: "rows",
      range,
      as_of,
      source,
      definition: "row",
    }),
    "vet402.attempts": record("vet402.attempts", {
      value: counts.attempts,
      unit: "purchase attempts",
      range,
      as_of,
      source,
      definition: "attempt",
    }),
    "vet402.not_attempts": record("vet402.not_attempts", {
      value: counts.not_attempts,
      unit: "rows",
      range,
      as_of,
      source,
      definition: "not_attempt",
    }),
    "vet402.not_settled": record("vet402.not_settled", {
      value: counts.not_settled,
      unit: "purchase attempts",
      range,
      as_of,
      source,
      definition: "not_settled",
    }),
    "vet402.pending": record("vet402.pending", {
      value: counts.pending,
      unit: "purchase attempts",
      range,
      as_of,
      source,
      definition: "pending",
    }),
    "vet402.settled": record("vet402.settled", {
      value: counts.settled,
      unit: "purchases",
      range,
      as_of,
      source,
      definition: "settled",
    }),
    "vet402.held": record("vet402.held", {
      value: counts.held,
      unit: "purchases",
      range,
      as_of,
      source,
      definition: "held",
    }),
    "vet402.delivered": record("vet402.delivered", {
      value: counts.delivered,
      unit: "purchases",
      range,
      as_of,
      source,
      definition: "delivered",
    }),
    "vet402.delivered_excl_202": record("vet402.delivered_excl_202", {
      value: counts.delivered_excl_202,
      unit: "purchases",
      range,
      as_of,
      source,
      definition: "delivered",
    }),
    "vet402.unexplained": record("vet402.unexplained", {
      value: counts.unexplained,
      unit: "purchases",
      range,
      as_of,
      source,
      definition: "unexplained",
    }),
    ...extraNumbers,
  };
  return {
    generated_at,
    snapshot,
    numbers,
    breakdown,
    definitions: DEFINITIONS,
    checks,
    quotes,
    model,
  };
}

// Ratios the README quotes. Each one is computed here from numbers above, never typed by hand.
export function derivedNumbers(n, breakdown = []) {
  const out = {};
  const base = n["vet402.settled"];
  out["vet402.settled_no_tx"] = record("vet402.settled_no_tx", {
    value: breakdown.filter((b) => b.status === "settled" && !b.has_tx).reduce((sum, b) => sum + b.count, 0),
    unit: "purchases",
    range: base.range,
    as_of: base.as_of,
    source: base.source,
    definition: "settled",
  });
  out["vet402.settled_not_held"] = record("vet402.settled_not_held", {
    value: base.value - n["vet402.held"].value,
    unit: "purchases",
    range: base.range,
    as_of: base.as_of,
    source: base.source,
    definition: "settled",
  });
  out["vet402.delivered_share"] = record("vet402.delivered_share", {
    value: n["vet402.delivered"].value / base.value,
    unit: "share of settled purchases",
    range: base.range,
    as_of: base.as_of,
    source: base.source,
    definition: "delivered",
  });
  out["vet402.unexplained_share_excl_held"] = record("vet402.unexplained_share_excl_held", {
    value: n["vet402.unexplained"].value / (base.value - n["vet402.held"].value),
    unit: "share of settled purchases, vet402-held excluded",
    range: base.range,
    as_of: base.as_of,
    source: base.source,
    definition: "unexplained",
  });
  const vault = n["vault.usdc_out_30d.usd"];
  const x402 = n["x402.total.amount_30d"];
  const baseShare = n["x402.base.share_amount_30d"];
  if (vault && x402 && baseShare) {
    out["compare.vault_over_x402_base_30d"] = record("compare.vault_over_x402_base_30d", {
      value: vault.value / (x402.value * baseShare.value),
      unit: "times",
      range: { vault: vault.range, x402: x402.range },
      as_of: x402.as_of,
      source: `${vault.source}+${x402.source}`,
      definition: "USDC sent out of the NEAR Intents treasury on Base (all purposes) over x402 dollars on Base, both 30 days",
    });
  }
  return out;
}

function splitPair(pair) {
  const colon = pair.indexOf(":");
  if (colon <= 0 || colon === pair.length - 1) {
    throw new Error("usage: node thesis.mjs --render <in.tmpl.md:out.md>");
  }
  return [pair.slice(0, colon), pair.slice(colon + 1)];
}

async function runRender(args, cwd) {
  const thesisPath = args.thesisPath ? resolve(cwd, args.thesisPath) : join(cwd, "data", "thesis.json");
  const thesis = JSON.parse(await readFile(thesisPath, "utf8"));
  const docsDir = join(cwd, "docs");
  await mkdir(docsDir, { recursive: true });
  const snapshotCopy = join(cwd, "data", "thesis.json");
  if (await exists(snapshotCopy)) {
    await copyFile(snapshotCopy, join(docsDir, "thesis.json"));
  }
  for (const pair of args.renderPairs) {
    const [fromRel, toRel] = splitPair(pair);
    const from = resolve(cwd, fromRel);
    const to = resolve(cwd, toRel);
    const rendered = renderTemplate(await readFile(from, "utf8"), thesis);
    await mkdir(dirname(to), { recursive: true });
    await writeFile(to, rendered);
  }
  return { exitCode: 0 };
}

async function loadRecheckSummary(snapshotPath) {
  const path = join(snapshotPath, "recheck.json");
  if (!(await exists(path))) return null;
  return summaryFromFile(JSON.parse(await readFile(path, "utf8")));
}

async function runRecheck(args, cwd) {
  const snapshotPath = resolve(cwd, args.snapshotDir);
  const derivedPath = join(snapshotPath, "export.derived.csv");
  const parsed = parseCsv(await readFile(derivedPath, "utf8"));
  const result = await recheckRows(parsed.rows, { all: args.recheckAll });
  const stored = {
    retrieved_at: new Date().toISOString(),
    base: result.base,
    solana: result.solana,
    other: "not re-checked",
  };
  await mkdir(snapshotPath, { recursive: true });
  await writeFile(join(snapshotPath, "recheck.json"), `${JSON.stringify(stored, null, 2)}\n`);
  const summary = summaryFromFile(stored);
  const thesisPath = join(cwd, "data", "thesis.json");
  if (await exists(thesisPath)) {
    const thesis = JSON.parse(await readFile(thesisPath, "utf8"));
    thesis.rechecks = summary;
    await writeFile(thesisPath, `${JSON.stringify(thesis, null, 2)}\n`);
  }
  const line = (name, side) =>
    `${name} checked=${side.checked} match=${side.match} mismatch=${side.mismatch} not_rechecked=${side.not_rechecked}`;
  console.log(line("base", summary.base));
  console.log(line("solana", summary.solana));
  console.log("other: not re-checked");
  if (summary.base.checked === 0) console.log("base had no re-checked receipt");
  if (summary.solana.checked === 0) console.log("solana had no re-checked receipt");
  return { exitCode: 0 };
}

async function runCheck(args, cwd) {
  if (!args.checkFiles || args.checkFiles.length === 0) {
    throw new Error("usage: node thesis.mjs --check <files...>");
  }
  const thesisPath = args.thesisPath
    ? resolve(cwd, args.thesisPath)
    : join(cwd, "data", "thesis.json");
  const thesis = JSON.parse(await readFile(thesisPath, "utf8"));
  if (!thesis.numbers) throw new Error("thesis has no numbers");
  const files = args.checkFiles.map((file) => resolve(cwd, file));
  // A file built from a template is checked by building it again: any edited figure shows up as a diff.
  const templated = [];
  const plain = [];
  for (const file of files) {
    const tmpl = file.replace(/\.md$/, ".tmpl.md");
    if (tmpl !== file && (await exists(tmpl))) templated.push([file, tmpl]);
    else plain.push(file);
  }
  let diffCount = 0;
  for (const [file, tmpl] of templated) {
    const want = renderTemplate(await readFile(tmpl, "utf8"), thesis).split("\n");
    const got = (await readFile(file, "utf8")).split("\n");
    for (let i = 0; i < Math.max(want.length, got.length); i += 1) {
      if (want[i] !== got[i]) {
        diffCount += 1;
        if (diffCount <= 10) console.log(`  ${file}:${i + 1} differs from ${tmpl} built with thesis.json`);
      }
    }
  }
  const result = checkSurfaces(plain, thesis.numbers);
  result.count += diffCount;
  console.log(`mismatches: ${result.count}`);
  for (const mismatch of result.mismatches) {
    console.log(`  ${mismatch.file}: ${mismatch.id} (got ${mismatch.got}, want ${mismatch.want})`);
  }
  for (const note of result.notes) console.log(`note: ${note}`);
  return { exitCode: result.count === 0 ? 0 : 1 };
}

async function runFetchVault(args, snapshotPath) {
  const retrieved_at = new Date().toISOString();
  const result = await fetchVaultLogs({
    fromBlock: args.fromBlock,
    toBlock: args.toBlock,
    rpcs: args.vaultRpcs.length > 0 ? args.vaultRpcs : DEFAULT_RPCS,
    pauseMs: args.vaultRpcs.length > 0 ? 0 : 100,
  });
  await writeVault(snapshotPath, result, {
    from_block: args.fromBlock,
    to_block: args.toBlock,
    retrieved_at,
  });
  if (result.unfetched_windows !== 0) {
    throw new Error(`unfetched_windows ${result.unfetched_windows}`);
  }
}

async function loadQuotes(cwd) {
  const quotesPath = join(cwd, "data", "quotes.json");
  if (!(await exists(quotesPath))) {
    await mkdir(dirname(quotesPath), { recursive: true });
    await writeFile(quotesPath, "[]\n");
    return [];
  }
  const text = await readFile(quotesPath, "utf8");
  const parsed = text.trim() === "" ? [] : JSON.parse(text);
  return readQuotes(parsed);
}

export async function main(argv, { cwd = ROOT } = {}) {
  const args = parseArgs(argv);
  if (args.checkQuotes) {
    const quotes = JSON.parse(await readFile(join(cwd, "data", "quotes.json"), "utf8"));
    const results = await checkQuotes(quotes);
    for (const r of results) console.log(`${r.result.padEnd(9)} ${r.id}`);
    const missing = results.filter((r) => r.result === "missing").length;
    console.log(`quotes: ${results.length}, missing: ${missing}`);
    return { exitCode: missing ? 1 : 0 };
  }
  if (args.checkFiles) return runCheck(args, cwd);
  if (args.renderPairs) return runRender(args, cwd);
  if (args.recheck && !args.offline) return runRecheck(args, cwd);

  const snapshotPath = resolve(cwd, args.snapshotDir);
  if (args.fetchVault) {
    if (args.offline) throw new Error("cannot --fetch-vault with --offline");
    if (!Number.isInteger(args.fromBlock) || !Number.isInteger(args.toBlock) || args.toBlock <= args.fromBlock) {
      throw new Error("--fetch-vault needs --from-block and a greater --to-block");
    }
    await runFetchVault(args, snapshotPath);
  }
  const nearDir = join(snapshotPath, "near");
  if (args.fetchNear && args.fetchRelays) throw new Error("cannot --fetch-relays with --fetch-near");
  if (args.fetchNear) {
    if (args.offline) throw new Error("cannot --fetch-near with --offline");
    await fetchNear(nearDir, { log: (line) => console.error(`fetch-near: ${line}`) });
    // Only the NEAR sources are fetched. Everything else is rebuilt from the frozen snapshot.
    args.offline = true;
  }
  if (args.fetchRelays) {
    if (args.offline) throw new Error("cannot --fetch-relays with --offline");
    await fetchKnownRelays(nearDir, { log: (line) => console.error(`fetch-relays: ${line}`) });
    args.offline = true;
  }

  const derivedPath = join(snapshotPath, "export.derived.csv");
  const metaPath = join(snapshotPath, "export.meta.json");
  const thesisPath = join(cwd, "data", "thesis.json");
  const rawPath = join(cwd, "data", "raw", "export.csv");
  const generated_at = new Date().toISOString();

  let rows;
  let snapshot;

  if (args.offline) {
    const derivedText = await readFile(derivedPath, "utf8");
    const parsed = parseCsv(derivedText);
    rows = parsed.rows;
    snapshot = JSON.parse(await readFile(metaPath, "utf8"));
  } else {
    let rawBuf;
    if (await exists(rawPath)) {
      rawBuf = await readFile(rawPath);
    } else {
      rawBuf = await fetchExport(rawPath);
    }
    const export_sha256 = sha256Buffer(rawBuf);
    let export_retrieved_at;
    if (await exists(metaPath)) {
      const prev = JSON.parse(await readFile(metaPath, "utf8"));
      if (prev.export_sha256 === export_sha256 && prev.export_retrieved_at) {
        export_retrieved_at = prev.export_retrieved_at;
      }
    }
    if (!export_retrieved_at) {
      const st = await stat(rawPath);
      export_retrieved_at = st.mtime.toISOString();
    }
    snapshot = {
      export_sha256,
      export_url: EXPORT_URL,
      export_retrieved_at,
    };
    const parsed = parseCsv(rawBuf.toString("utf8"));
    const derived = deriveRows(parsed.headers, parsed.rows);
    rows = derived.rows;
    await mkdir(snapshotPath, { recursive: true });
    await writeFile(derivedPath, stringifyCsv(derived.headers, derived.rows));
    await writeFile(metaPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  const x402 = await loadX402({
    dir: join(snapshotPath, "x402scan"),
    metaPath: join(snapshotPath, "x402scan-meta.json"),
    offline: args.offline,
  });
  const llama = await loadDefillama({
    file: join(snapshotPath, "defillama-near-intents.json"),
    metaPath: join(snapshotPath, "defillama-near-intents.meta.json"),
    offline: args.offline,
  });
  const vaultNumbers = await loadVaultNumbers(snapshotPath);
  const nearLoaded = (await exists(join(nearDir, NEAR_MANIFEST))) ? await loadNear(nearDir) : null;
  snapshot = {
    ...snapshot,
    ...(nearLoaded ? { near_retrieved_at: nearLoaded.near.retrieved_at } : {}),
    x402scan_retrieved_at: x402["x402.total.amount_30d"].as_of,
    defillama_retrieved_at: llama.numbers["intents.volume_30d"].as_of,
    derived_sha256: sha256Buffer(await readFile(derivedPath)),
  };

  let inputs = null;
  const inputsPath = join(cwd, "data", "model-inputs.json");
  if (await exists(inputsPath)) {
    inputs = readModelInputs(await readFile(inputsPath, "utf8"));
  }
  const model = buildModel({
    x402_30d_usd: x402["x402.total.amount_30d"].value,
    intents_30d_usd: llama.volume_30d,
    inputs,
    chart: llama.chart,
  });
  const quotes = await loadQuotes(cwd);
  const summary = summarize(rows);
  const thesis = buildThesis({
    summary,
    snapshot,
    generated_at,
    extraNumbers: { ...x402, ...llama.numbers, ...(vaultNumbers ?? {}), ...(nearLoaded?.numbers ?? {}) },
    model,
    quotes,
  });
  Object.assign(thesis.numbers, derivedNumbers(thesis.numbers, thesis.breakdown));
  if (nearLoaded) thesis.near = { ...nearLoaded.near, limits: nearLoaded.limits };
  {
    const settledRec = thesis.numbers["vet402.settled"];
    thesis.numbers["vet402.settled_seller_claim"] = record("vet402.settled_seller_claim", {
      value: rows.filter((r) => r.status === "settled" && r.settlement_source === "seller_claim").length,
      unit: "purchases",
      range: settledRec.range,
      as_of: settledRec.as_of,
      source: settledRec.source,
      definition: "settled",
    });
  }
  const rechecks = await loadRecheckSummary(snapshotPath);
  if (rechecks) {
    thesis.rechecks = rechecks;
    const rec = JSON.parse(await readFile(join(snapshotPath, "recheck.json"), "utf8"));
    for (const chain of ["base", "solana"]) {
      for (const key of ["checked", "match", "mismatch", "not_rechecked"]) {
        const id = `recheck.${chain}.${key}`;
        thesis.numbers[id] = record(id, {
          value: rechecks[chain][key],
          unit: "settled purchases",
          range: thesis.numbers["vet402.settled"].range,
          as_of: rec.retrieved_at,
          source: chain === "base" ? "base_public_rpc" : "solana_public_rpc",
          definition: "settled",
        });
      }
    }
  }
  await mkdir(dirname(thesisPath), { recursive: true });
  await writeFile(thesisPath, `${JSON.stringify(thesis, null, 2)}\n`);
  const allOk = thesis.checks.every((c) => c.ok);
  if (!allOk) {
    const failed = thesis.checks.filter((c) => !c.ok).map((c) => c.name);
    throw new Error(`checks failed: ${failed.join(", ")}`);
  }
  const sourceLabel = args.fetchNear
    ? "fresh NEAR sources and data/snapshot"
    : args.fetchRelays
      ? "the relayer census and data/snapshot"
      : args.offline
        ? "data/snapshot (no network)"
        : "the public sources";
  const pending = !nearLoaded || nearLoaded.relaysPending ? ", full count not yet fetched" : "";
  console.log(
    `rebuilt ${Object.keys(thesis.numbers).length} numbers from ${sourceLabel}, ${thesis.checks.length} checks ok, wrote data/thesis.json${pending}`,
  );
  return thesis;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked || import.meta.url === pathToFileURL(invoked).href) {
  main(process.argv.slice(2))
    .then((result) => {
      if (result && result.exitCode) process.exit(result.exitCode);
    })
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
