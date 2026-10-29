import assert from "node:assert/strict";
import { test } from "node:test";
import { intentsFromBody } from "../lib/sources/defillama.mjs";

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
