import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Runs in a throwaway copy so the test never rewrites the committed snapshot.
function runThesis(dir, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["thesis.mjs", ...args], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("--offline numbers match a normal run for the export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-thesis-"));
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
