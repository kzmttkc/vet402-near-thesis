import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { countMissing, formatValue, isMissingRecord } from "../docs/app.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("countMissing counts numbers that lack range, date, or source", () => {
  const complete = {
    value: 1,
    range: { from: "2026-08-14T00:00:00Z", to: "2026-10-29T00:00:00Z" },
    as_of: "2026-10-29T00:00:00Z",
    source: "vet402_export",
  };
  assert.equal(isMissingRecord(complete), false);
  assert.equal(isMissingRecord({ ...complete, range: undefined }), true);
  assert.equal(isMissingRecord({ ...complete, as_of: "" }), true);
  assert.equal(isMissingRecord({ ...complete, source: null }), true);
  assert.equal(isMissingRecord({ ...complete, range: {} }), true);
  assert.equal(isMissingRecord({ value: 3, range: { days: 30, to: "2026-10-29T00:00:00Z" }, as_of: "t" }), true);
  assert.equal(countMissing([
    complete,
    { value: 2 },
    { value: 3, range: { days: 30, to: "2026-10-29T00:00:00Z" }, as_of: "t" },
  ]), 2);
});

test("dashboard dollars follow unit_kind, so a USDC count stays a count", () => {
  assert.equal(formatValue({ value: 25400, unit: "NEAR delegate-action USDC transfers in 30 days", unit_kind: "count" }), "25,400");
  assert.equal(formatValue({ value: 41050145.312122, unit: "USD", unit_kind: "usd" }), "$41,050,145");
  assert.equal(formatValue({ value: 0.001, unit: "USDC", unit_kind: "usdc" }), "0.001");
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  for (const id of ["vet402.attempts", "vault.usdc_out_30d.count", "threshold.line", "near.delegate.transfers_30d"]) {
    assert.equal(formatValue(thesis.numbers[id]).includes("$"), false, id);
  }
  assert.equal(formatValue(thesis.numbers["vault.usdc_out_30d.usd"]).startsWith("$"), true);
});

test("dashboard page states the question and does not pull a CDN", () => {
  const html = readFileSync(join(ROOT, "docs", "index.html"), "utf8");
  const js = readFileSync(join(ROOT, "docs", "app.js"), "utf8");
  assert.match(html, /Where does NEAR fit in agent payments\? Numbers from one re-runnable script\./);
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /overflow-x:\s*auto/);
  assert.match(html, /overflow-x:\s*hidden/);
  assert.doesNotMatch(html, /https?:\/\//);
  const prose = `${html}\n${js}`.replaceAll("en-US", "");
  assert.doesNotMatch(prose, /—|–/);
  assert.doesNotMatch(prose, /\b(we|our|us)\b/i);
});
