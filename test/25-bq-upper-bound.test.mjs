import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { bigQueryUpperBoundNumbers } from "../thesis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the BigQuery file supplies 2418, 25400, and 1716", async () => {
  const doc = JSON.parse(await readFile(join(ROOT, "data/snapshot/near/bigquery-n-upper-bound.json"), "utf8"));
  assert.equal(doc.n_upper_bound, 2418);
  assert.equal(doc.line, 25400);
  assert.equal(doc.known_relay_lower_bound, 1716);
  assert.ok(doc.n_upper_bound < doc.line);
  assert.ok(doc.known_relay_lower_bound <= doc.n_upper_bound);
  assert.equal(doc.days.length, 31);
  assert.equal(doc.days.reduce((sum, day) => sum + day.matched, 0), doc.sum_of_daily_distinct);
  assert.equal(JSON.stringify(doc).includes("@"), false);

  const numbers = bigQueryUpperBoundNumbers(doc, doc.line, doc.known_relay_lower_bound);
  assert.equal(numbers["near.bq.n_upper_bound"].value, doc.n_upper_bound);
  assert.equal(numbers["near.bq.whole_dates"].value, doc.n_upper_bound_whole_dates);
  assert.equal(numbers["near.bq.sum_of_daily"].value, doc.sum_of_daily_distinct);
  assert.equal((numbers["near.bq.upper_share_of_line"].value * 100).toFixed(1), "9.5");

  const thesis = JSON.parse(await readFile(join(ROOT, "data/thesis.json"), "utf8"));
  assert.equal(thesis.numbers["near.bq.n_upper_bound"].value, doc.n_upper_bound);
  assert.equal(thesis.numbers["threshold.line"].value, doc.line);
  assert.equal(thesis.numbers["near.known.lower"].value, doc.known_relay_lower_bound);
  assert.equal(thesis.near.bq.bytes_processed, doc.bytes_processed);
  assert.equal(thesis.near.bq.retrieved_at, doc.retrieved_at);

  const verdict = "N < 25,400, all 30 days counted: the threshold is not crossed. The claim stands.";
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  const page = await readFile(join(ROOT, "THESIS.md"), "utf8");
  assert.ok(readme.includes(verdict));
  assert.ok(page.includes(verdict));
  assert.ok(readme.includes("N ≤ 2,418 < 25,400"));
  assert.equal(readme.includes("2,418 x402"), false);
  assert.equal(page.includes("2,418 x402"), false);
});
