import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { readQuotes } from "../lib/quotes.mjs";
import { formatForSurface } from "../lib/surface.mjs";

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
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("surface rounding is commas, one-decimal percent, and $M/$B", () => {
  assert.equal(formatForSurface({ value: 18683, unit: "purchase attempts" }), "18,683");
  assert.equal(formatForSurface({ value: 0.726, unit: "share of USD" }), "72.6%");
  assert.equal(formatForSurface({ value: 1556904.97, unit: "USD" }), "$1.56M");
  assert.equal(formatForSurface({ value: 4260019770, unit: "USD" }), "$4.26B");
  assert.equal(formatForSurface({ value: 10400000000, unit: "USD" }), "$10.4B");
  assert.equal(formatForSurface({ value: 52000000, unit: "USD" }), "$52M");
});

test("--check exits 0 on a matching surface and 1 when one figure is shifted", async () => {
  const ok = await runThesis(["--check", join("test", "fixtures", "check", "ok.md"), "--thesis", THESIS]);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /mismatches: 0/);
  assert.match(ok.stdout, /spelled-out numbers are not checked/);

  const shifted = await runThesis([
    "--check",
    join("test", "fixtures", "check", "shifted.md"),
    "--thesis",
    THESIS,
  ]);
  assert.equal(shifted.code, 1, shifted.stdout);
  assert.match(shifted.stdout, /mismatches: 1/);
  assert.match(shifted.stdout, /got 72\.5%, want 72\.6%/);
});

test("quotes.json is an array of id, url, full_sentence, context, retrieved_at", () => {
  assert.deepEqual(readQuotes([]), []);
  assert.throws(() => readQuotes({}), /array/);
  assert.throws(
    () => readQuotes([{ id: "q3", url: "https://example.invalid", full_sentence: "", context: "c", retrieved_at: "t" }]),
    /full_sentence/,
  );
  const quote = readQuotes([
    {
      id: "q3",
      url: "https://example.invalid/q3",
      full_sentence: "Q3 Intents volume was $10.4B.",
      context: "The State of NEAR: Q3 2026",
      retrieved_at: "2026-10-30T00:00:00Z",
    },
  ]);
  assert.equal(quote[0].full_sentence, "Q3 Intents volume was $10.4B.");
});
