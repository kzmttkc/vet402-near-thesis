// Needs the public network. Not part of `npm test` or bare `node --test`.
// Node runs every file under test/, so this file stays outside that directory.
// Run: node --test online/fetch-compare.mjs
// A throwaway copy fetches the public sources, then --offline rebuilds, and the two number sets match.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runThesis(dir, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["thesis.mjs", ...args], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("a fresh public fetch and --offline agree on numbers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-thesis-online-"));
  try {
    await cp(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) });
    const online = await runThesis(dir, []);
    assert.equal(online.code, 0, online.stderr);
    const first = JSON.parse(await readFile(join(dir, "data", "thesis.json"), "utf8"));
    const offline = await runThesis(dir, ["--offline"]);
    assert.equal(offline.code, 0, offline.stderr);
    const second = JSON.parse(await readFile(join(dir, "data", "thesis.json"), "utf8"));
    assert.deepEqual(second.numbers, first.numbers);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
