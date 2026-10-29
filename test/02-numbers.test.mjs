import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { classify } from "../lib/classify.mjs";
import { parseCsv } from "../lib/csv.mjs";
import { record } from "../lib/numbers.mjs";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "tiny.csv");

const COMPLETE = {
  value: 1,
  unit: "rows",
  range: { from: "2026-08-14T09:54:31Z", to: "2026-10-29T21:32:37Z" },
  as_of: "2026-10-30T00:00:00Z",
  source: "vet402_export",
  definition: "row",
};

test("record throws when range, as_of, or source is missing", () => {
  assert.doesNotThrow(() => record("vet402.rows", COMPLETE));
  assert.throws(() => record("vet402.rows", { ...COMPLETE, range: undefined }), /range/);
  assert.throws(() => record("vet402.rows", { ...COMPLETE, as_of: undefined }), /as_of/);
  assert.throws(() => record("vet402.rows", { ...COMPLETE, source: undefined }), /source/);
  assert.throws(() => record("vet402.rows", { ...COMPLETE, as_of: null }), /as_of/);
  assert.throws(() => record("vet402.rows", { ...COMPLETE, source: "" }), /source/);
});

test("tiny fixture records counts with range, as_of, source", async () => {
  const { rows } = parseCsv(await readFile(FIXTURE, "utf8"));
  const times = rows.map((r) => r.attempted_at).sort();
  const range = { from: times[0], to: times[times.length - 1] };
  const as_of = "2026-10-30T00:00:00Z";
  const source = "vet402_export";
  let attempts = 0;
  let settled = 0;
  for (const row of rows) {
    const got = classify(row);
    if (got.attempt) attempts += 1;
    if (got.settled) settled += 1;
  }
  const nAttempts = record("vet402.attempts", {
    value: attempts,
    unit: "purchase attempts",
    range,
    as_of,
    source,
    definition: "attempt",
  });
  const nSettled = record("vet402.settled", {
    value: settled,
    unit: "purchases",
    range,
    as_of,
    source,
    definition: "settled",
  });
  assert.equal(nAttempts.value, 10);
  assert.equal(nSettled.value, 4);
  assert.equal(nAttempts.range.from, "2026-08-14T09:54:31Z");
  assert.equal(nAttempts.range.to, "2026-10-29T21:32:37Z");
});
