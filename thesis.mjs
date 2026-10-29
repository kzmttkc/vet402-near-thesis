import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
import { checkSurfaces } from "./lib/surface.mjs";

export { USER_AGENT };
export const EXPORT_URL = "https://vet402.com/api/v1/observatory/export.csv?days=365";

const ROOT = dirname(fileURLToPath(import.meta.url));

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function parseArgs(argv) {
  const offline = argv.includes("--offline");
  const fetchVault = argv.includes("--fetch-vault");
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
  const vaultRpcs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--vault-rpc" && argv[i + 1]) vaultRpcs.push(argv[i + 1]);
  }
  return {
    offline,
    fetchVault,
    snapshotDir,
    thesisPath: thesisIdx >= 0 ? argv[thesisIdx + 1] : null,
    fromBlock: fromIdx >= 0 ? Number(argv[fromIdx + 1]) : null,
    toBlock: toIdx >= 0 ? Number(argv[toIdx + 1]) : null,
    checkFiles,
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
  const result = checkSurfaces(files, thesis.numbers);
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
  if (args.checkFiles) return runCheck(args, cwd);

  const snapshotPath = resolve(cwd, args.snapshotDir);
  if (args.fetchVault) {
    if (args.offline) throw new Error("cannot --fetch-vault with --offline");
    if (!Number.isInteger(args.fromBlock) || !Number.isInteger(args.toBlock) || args.toBlock <= args.fromBlock) {
      throw new Error("--fetch-vault needs --from-block and a greater --to-block");
    }
    await runFetchVault(args, snapshotPath);
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
  snapshot = {
    ...snapshot,
    x402scan_retrieved_at: x402["x402.total.amount_30d"].as_of,
    defillama_retrieved_at: llama.numbers["intents.volume_30d"].as_of,
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
    extraNumbers: { ...x402, ...llama.numbers, ...(vaultNumbers ?? {}) },
    model,
    quotes,
  });
  await mkdir(dirname(thesisPath), { recursive: true });
  await writeFile(thesisPath, `${JSON.stringify(thesis, null, 2)}\n`);
  const allOk = thesis.checks.every((c) => c.ok);
  if (!allOk) {
    const failed = thesis.checks.filter((c) => !c.ok).map((c) => c.name);
    throw new Error(`checks failed: ${failed.join(", ")}`);
  }
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
