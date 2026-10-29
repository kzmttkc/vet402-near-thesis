import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THESIS = join("test", "fixtures", "check", "thesis.json");

function runThesis(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["thesis.mjs", ...args], {
      cwd: ROOT,
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("unknown placeholder and missing id exit 1", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-render-"));
  const unknownIn = join(dir, "unknown.tmpl.md");
  const unknownOut = join(dir, "unknown.md");
  await writeFile(unknownIn, "Hello {{nope}}.\n");
  const unknown = await runThesis(["--render", `${unknownIn}:${unknownOut}`, "--thesis", THESIS]);
  assert.equal(unknown.code, 1, unknown.stdout);
  assert.match(unknown.stderr, /unknown placeholder: \{\{nope\}\}/);

  const missingIn = join(dir, "missing.tmpl.md");
  const missingOut = join(dir, "missing.md");
  await writeFile(missingIn, "{{n:does.not.exist}}\n");
  const missing = await runThesis(["--render", `${missingIn}:${missingOut}`, "--thesis", THESIS]);
  assert.equal(missing.code, 1, missing.stdout);
  assert.match(missing.stderr, /missing id: does\.not\.exist/);
  await assert.rejects(() => import("node:fs/promises").then((fs) => fs.stat(missingOut)));
});
