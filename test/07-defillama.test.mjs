import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { intentsFromBody } from "../lib/sources/defillama.mjs";
import { closeIntentsVolume30d } from "../thesis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAY_MS = 86_400_000;

function chartFrom(values) {
  return values.map((value, index) => [1_700_000_000 + index * 86400, value]);
}

function body(values, total24h, totalAllTime = 100_000) {
  return { total24h, totalAllTime, totalDataChart: chartFrom(values) };
}

test("drops the last day when it repeats the previous day, then re-sums 30", () => {
  const values = Array.from({ length: 32 }, (_, index) => index + 1);
  values[31] = values[30];
  const got = intentsFromBody(body(values, 5), "2026-10-30T00:00:00Z");
  assert.equal(got.dropped, true);
  assert.equal(got.volume_30d, 495);
  assert.notEqual(
    got.volume_30d,
    values.slice(-30).reduce((sum, value) => sum + value, 0),
  );
  assert.equal(got.numbers["intents.volume_all_time"].value, 100_000);
  assert.equal(got.numbers["intents.volume_30d"].range.dropped_last_day, true);
  assert.equal(got.numbers["intents.volume_30d"].source, "defillama_intents");
});

test("drops the last day when total24h is null even if the value changed", () => {
  const values = Array.from({ length: 32 }, (_, index) => index + 1);
  const got = intentsFromBody(body(values, null), "2026-10-30T00:00:00Z");
  assert.equal(got.dropped, true);
  assert.equal(got.volume_30d, 495);
  assert.equal(got.numbers["intents.volume_all_time"].value, 100_000);
});

test("keeps the last day when total24h is present and it differs from the day before", () => {
  const values = Array.from({ length: 32 }, (_, index) => index + 1);
  const got = intentsFromBody(body(values, 32), "2026-10-30T00:00:00Z");
  assert.equal(got.dropped, false);
  assert.equal(got.volume_30d, 525);
  assert.equal(got.numbers["intents.volume_30d"].range.dropped_last_day, false);
});

test("the frozen intents 30-day window ends one day after the last point", async () => {
  const text = await readFile(join(ROOT, "data/snapshot/defillama-near-intents.json"), "utf8");
  const meta = JSON.parse(
    await readFile(join(ROOT, "data/snapshot/defillama-near-intents.meta.json"), "utf8"),
  );
  const got = intentsFromBody(text, meta.retrieved_at);
  const open = got.numbers["intents.volume_30d"].range;
  const closed = closeIntentsVolume30d(open);
  assert.equal(open.to, "2026-10-28T00:00:00.000Z");
  assert.equal(closed.from, "2026-09-29T00:00:00.000Z");
  assert.equal(closed.to, "2026-10-29T00:00:00.000Z");
  assert.equal(Date.parse(closed.to) - Date.parse(closed.from), 30 * DAY_MS);
  assert.equal(got.volume_30d, 3_965_443_376);
  assert.equal(got.numbers["intents.volume_all_time"].range.to, open.to);
});
