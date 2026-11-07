import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModel, formatRatioPercent, readModelInputs } from "../lib/model.mjs";
import { x402Numbers, x402Url } from "../lib/sources/x402scan.mjs";

function overall(amount, count, timestamp) {
  return {
    result: {
      data: {
        json: {
          total_transactions: count,
          total_amount: amount,
          latest_block_timestamp: timestamp,
        },
      },
    },
  };
}

test("base share is base divided by the no-chain total, after dividing raw amounts by 1e6", () => {
  const timestamp = "2026-10-29T20:45:45.000Z";
  const numbers = x402Numbers(
    {
      all: overall(2_000_000, 40, timestamp),
      base: overall(500_000, 10, timestamp),
    },
    "2026-10-30T00:00:00Z",
  );
  assert.equal(numbers["x402.total.amount_30d"].value, 2);
  assert.equal(numbers["x402.base.share_amount_30d"].value, 0.25);
  assert.equal(numbers["x402.base.share_count_30d"].value, 0.25);
  assert.equal(numbers["x402.total.amount_30d"].range.to, timestamp);
  assert.equal(numbers["x402.total.amount_30d"].range.days, 30);
  assert.equal(numbers["x402.base.share_amount_30d"].source, "x402scan");
  assert.equal(numbers["x402.base.share_amount_30d"].as_of, "2026-10-30T00:00:00Z");
  assert.equal(numbers["x402.base.share_amount_30d"].unit, "share of USD");
});

test("x402 url omits chain for the overall query and sets it otherwise", () => {
  const all = JSON.parse(decodeURIComponent(new URL(x402Url("all")).searchParams.get("input")));
  const base = JSON.parse(decodeURIComponent(new URL(x402Url("base")).searchParams.get("input")));
  assert.deepEqual(all, { json: { timeframe: 30 } });
  assert.deepEqual(base, { json: { timeframe: 30, chain: "base" } });
});

test("model states x402 30d over intents 30d above a 4x3 table, and omits the table without inputs", () => {
  assert.equal(formatRatioPercent(1_556_904.97 / 4_260_019_770), "0.037%");
  const bare = buildModel({
    x402_30d_usd: 1_556_904.97,
    intents_30d_usd: 4_260_019_770,
    inputs: null,
    chart: null,
  });
  assert.equal(bare.table, null);
  assert.equal(bare.x402_over_intents_30d_display, "0.037%");

  const inputs = readModelInputs(
    JSON.stringify({
      q3_intents_usd: 999,
      cumulative_intents_usd: 200,
      cumulative_fees_usd: 100,
      buyback_usd: 8,
      take_rate: 0.5,
    }),
  );
  const model = buildModel({
    x402_30d_usd: 100,
    intents_30d_usd: 400,
    inputs,
    chart: null,
  });
  assert.equal(model.table.length, 12);
  assert.equal(new Set(model.table.map((row) => row.multiple)).size, 4);
  assert.equal(new Set(model.table.map((row) => row.pass_through)).size, 3);
  const cell = model.table.find((row) => row.multiple === 1 && row.pass_through === 0.5);
  assert.equal(cell.annual_near_usd, 150);
  assert.equal(model.buyback_multiples.pass_50pct, 8 / 150);
  assert.equal(model.buyback_multiples.pass_10pct, 8 / 30);
  assert.equal(model.buyback_multiples.pass_1pct, 8 / 3);
  assert.ok(cell.assumption_ids.includes("take_rate"));
  assert.ok(cell.assumption_ids.includes("fee_rate_cumulative"));
  // The Q3 figure must not change the fee rate (fees and volume share one period).
  assert.equal(model.fee_rate, 0.5);
  assert.equal(model.x402_over_intents_30d_display, "25.000%");

  const asPercent = readModelInputs(
    JSON.stringify({
      q3_intents_usd: 10.4e9,
      cumulative_intents_usd: 32e9,
      cumulative_fees_usd: 52e6,
      buyback_usd: 8e6,
      take_rate: 16.4,
    }),
  );
  assert.ok(Math.abs(asPercent.take_rate - 0.164) < 1e-12);
  assert.equal(readModelInputs("{}"), null);
});
