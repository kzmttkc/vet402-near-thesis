import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseCsv } from "../lib/csv.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw", "export.csv");

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (full === join(ROOT, "data", "raw")) continue;
      await walk(full, out);
      continue;
    }
    if (entry.isFile()) out.push(full);
  }
}

test("git-eligible files contain zero original resource_key strings", async () => {
  let raw;
  try {
    raw = await readFile(RAW, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      assert.ok(true, "no export.csv to scan");
      return;
    }
    throw err;
  }
  const { rows } = parseCsv(raw);
  const keys = [...new Set(rows.map((r) => r.resource_key).filter(Boolean))];
  assert.ok(keys.length > 0);

  const files = [];
  await walk(ROOT, files);
  const hits = [];
  for (const file of files) {
    const info = await stat(file);
    if (info.size === 0) continue;
    const text = await readFile(file, "utf8");
    for (const key of keys) {
      if (text.includes(key)) {
        hits.push(relative(ROOT, file));
        break;
      }
    }
  }
  assert.deepEqual(hits, []);
});
