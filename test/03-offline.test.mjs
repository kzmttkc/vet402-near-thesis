import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runThesis(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["thesis.mjs", ...args], {
      cwd: ROOT,
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
  const online = await runThesis([]);
  assert.equal(online.code, 0, online.stderr);
  const first = JSON.parse(await readFile(join(ROOT, "data", "thesis.json"), "utf8"));
  const offline = await runThesis(["--offline"]);
  assert.equal(offline.code, 0, offline.stderr);
  const second = JSON.parse(await readFile(join(ROOT, "data", "thesis.json"), "utf8"));
  assert.deepEqual(second.numbers, first.numbers);
});
