import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { bigQueryUpperBoundNumbers } from "../thesis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the BigQuery file supplies the whole-date bound 2532 and the minute window 2418", async () => {
  const doc = JSON.parse(await readFile(join(ROOT, "data/snapshot/near/bigquery-n-upper-bound.json"), "utf8"));
  const facilitators = JSON.parse(await readFile(join(ROOT, "data/snapshot/near/facilitators.json"), "utf8"));
  assert.equal(doc.n_upper_bound, 2418);
  assert.equal(doc.n_upper_bound_whole_dates, 2532);
  assert.equal(doc.line, 25400);
  assert.equal(doc.known_relay_lower_bound, 1716);
  assert.ok(doc.n_upper_bound_whole_dates < doc.line);
  assert.ok(doc.known_relay_lower_bound <= doc.n_upper_bound_whole_dates);
  assert.equal(doc.days.length, 31);
  assert.equal(doc.days.reduce((sum, day) => sum + day.matched, 0), doc.sum_of_daily_distinct);
  assert.equal(JSON.stringify(doc).includes("@"), false);
  const censusTo = facilitators.window.to;
  assert.ok(new Date(censusTo) - new Date(doc.window_utc[1]) > 27_000);
  assert.ok(new Date("2026-10-08T00:00:00Z") <= new Date(facilitators.window.from));
  assert.ok(new Date(censusTo) < new Date("2026-11-08T00:00:00Z"));
  const last = doc.days.at(-1);
  assert.ok(new Date(`${last.block_date}T${last.last_block_utc}Z`) > new Date(censusTo));
  const whole = doc.jobs.find((job) => job.count === 2532);
  const minute = doc.jobs.find((job) => job.count === 2418);
  assert.equal(whole.id, "job_9RryoOYvLbEXZ1Emk9d0ThJ273x2");
  assert.equal(whole.ran_at, "2026-11-07T21:04:39Z");
  assert.equal(whole.bytes_processed, "83.96 GB");
  assert.equal(whole.location, "us-east1");
  assert.equal(minute.id, "job_P2IOUNAwg1YB614m6IbO97J1B8BV");
  assert.equal(minute.ran_at, "2026-11-07T21:07:15Z");
  assert.equal(minute.bytes_processed, "85.36 GB");
  assert.equal(minute.location, "us-east1");

  const numbers = bigQueryUpperBoundNumbers(doc, doc.line, doc.known_relay_lower_bound);
  assert.equal(numbers["near.bq.n_upper_bound"].value, doc.n_upper_bound_whole_dates);
  assert.equal(numbers["near.bq.minute_window"].value, doc.n_upper_bound);
  assert.equal(numbers["near.bq.whole_dates"].value, doc.n_upper_bound_whole_dates);
  assert.equal(numbers["near.bq.sum_of_daily"].value, doc.sum_of_daily_distinct);
  assert.equal((numbers["near.bq.upper_share_of_line"].value * 100).toFixed(1), "10.0");

  const thesis = JSON.parse(await readFile(join(ROOT, "data/thesis.json"), "utf8"));
  assert.equal(thesis.numbers["near.bq.n_upper_bound"].value, doc.n_upper_bound_whole_dates);
  assert.equal(thesis.numbers["near.bq.minute_window"].value, doc.n_upper_bound);
  assert.equal(thesis.numbers["threshold.line"].value, doc.line);
  assert.equal(thesis.numbers["near.known.lower"].value, doc.known_relay_lower_bound);
  assert.equal(thesis.near.bq.bytes_processed, whole.bytes_processed);
  assert.equal(thesis.near.bq.retrieved_at, whole.ran_at);

  const verdict = "N < 25,400, all 30 days counted: the threshold is not crossed. The claim stands.";
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  const page = await readFile(join(ROOT, "THESIS.md"), "utf8");
  assert.ok(page.includes(verdict));
  assert.ok(readme.includes("N ≤ 2,532 < 25,400"));
  assert.equal(readme.includes("2,418 x402"), false);
  assert.equal(page.includes("2,418 x402"), false);
  assert.equal(readme.split("2,418").length - 1, 0);
  assert.equal(page.split("2,418").length - 1, 2);
});
