import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("rendered template checks clean, and one shifted figure exits 1", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-check-"));
  const input = join(dir, "page.tmpl.md");
  const output = join(dir, "page.md");
  await writeFile(
    input,
    [
      "Attempts {{n:vet402.attempts}} (vet402.attempts).",
      "Share {{n:x402.base.share_amount_30d}} (x402.base.share_amount_30d).",
      "Volume {{n:x402.total.amount_30d}} (x402.total.amount_30d).",
      "",
    ].join("\n"),
  );
  const rendered = await runThesis(["--render", `${input}:${output}`, "--thesis", THESIS]);
  assert.equal(rendered.code, 0, rendered.stderr);
  const ok = await runThesis(["--check", output, "--thesis", THESIS]);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /mismatches: 0/);

  const text = await readFile(output, "utf8");
  assert.match(text, /18,683/);
  assert.match(text, /\$1,556,905/);
  await writeFile(output, text.replace("18,683", "18,684"));
  const shifted = await runThesis(["--check", output, "--thesis", THESIS]);
  assert.equal(shifted.code, 1, shifted.stdout);
  assert.match(shifted.stdout, /mismatches: 1/);
});
