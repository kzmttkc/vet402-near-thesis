import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summarize } from "./lib/classify.mjs";
import { parseCsv, stringifyCsv } from "./lib/csv.mjs";
import { DEFINITIONS } from "./lib/definitions.mjs";
import { deriveRows } from "./lib/derive.mjs";
import { record } from "./lib/numbers.mjs";

export const EXPORT_URL = "https://vet402.com/api/v1/observatory/export.csv?days=365";
export const USER_AGENT = "vet402-near-thesis/0.1 (+https://vet402.com)";

const ROOT = dirname(fileURLToPath(import.meta.url));

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function parseArgs(argv) {
  const offline = argv.includes("--offline");
  const snapIdx = argv.indexOf("--snapshot");
  const snapshotDir = snapIdx >= 0 ? argv[snapIdx + 1] : join("data", "snapshot");
  return { offline, snapshotDir };
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

function buildThesis({ summary, snapshot, generated_at }) {
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
  };
  return {
    generated_at,
    snapshot,
    numbers,
    breakdown,
    definitions: DEFINITIONS,
    checks,
  };
}

export async function main(argv, { cwd = ROOT } = {}) {
  const { offline, snapshotDir } = parseArgs(argv);
  const snapshotPath = resolve(cwd, snapshotDir);
  const derivedPath = join(snapshotPath, "export.derived.csv");
  const metaPath = join(snapshotPath, "export.meta.json");
  const thesisPath = join(cwd, "data", "thesis.json");
  const rawPath = join(cwd, "data", "raw", "export.csv");
  const generated_at = new Date().toISOString();

  let rows;
  let headers;
  let snapshot;

  if (offline) {
    const derivedText = await readFile(derivedPath, "utf8");
    const parsed = parseCsv(derivedText);
    headers = parsed.headers;
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
    headers = parsed.headers;
    const derived = deriveRows(headers, parsed.rows);
    headers = derived.headers;
    rows = derived.rows;
    await mkdir(snapshotPath, { recursive: true });
    await writeFile(derivedPath, stringifyCsv(derived.headers, derived.rows));
    await writeFile(metaPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  const summary = summarize(rows);
  const thesis = buildThesis({ summary, snapshot, generated_at });
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
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
