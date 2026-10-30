import assert from "node:assert/strict";
import { test } from "node:test";
import { formatNumber, formatRange, renderTemplate } from "../lib/render.mjs";

test("render format: share, USD, count, and range", () => {
  assert.equal(formatNumber({ value: 0.7297, unit: "share of USD" }), "73.0%");
  assert.equal(formatNumber({ value: 0.726, unit: "share of count" }), "72.6%");
  assert.equal(formatNumber({ value: 41050145.312122, unit: "USD" }), "$41,050,145");
  assert.equal(formatNumber({ value: 41050145.312122, unit: "USD" }, { compact: true }), "$41.05M");
  assert.equal(formatNumber({ value: 1556904.97, unit: "USD" }), "$1,556,905");
  assert.equal(formatNumber({ value: 3965443376, unit: "USD" }, { compact: true }), "$3.97B");
  assert.equal(formatNumber({ value: 18683, unit: "purchase attempts" }), "18,683");
  assert.equal(
    formatRange({ from: "2026-08-14T09:54:31Z", to: "2026-10-29T21:32:37Z" }),
    "from 2026-08-14 09:54 to 2026-10-29 21:32",
  );
  assert.equal(formatRange({ from_block: 51965969, to_block: 53261969 }), "blocks 51965969 to 53261969");
});

test("render fills model, breakdown, quotes, definitions, and snapshot", () => {
  const thesis = {
    snapshot: { export_sha256: "abc", export_retrieved_at: "2026-10-29T22:04:40.090Z" },
    numbers: {
      "vet402.attempts": {
        value: 18683,
        unit: "purchase attempts",
        range: { from: "2026-08-14T09:54:31Z", to: "2026-10-29T21:32:37Z" },
        as_of: "2026-10-29T22:04:40.090Z",
        source: "vet402_export",
      },
    },
    breakdown: [
      { category: "3-settled", status: "settled", held_reason: "", has_tx: true, http_2xx: true, count: 10 },
      { category: "1-not-settled", status: "settle_failed", held_reason: "payer_unfunded", has_tx: false, http_2xx: false, count: 1032 },
    ],
    definitions: { attempt: "A row whose network is non-empty." },
    quotes: [{ id: "q", url: "https://example.invalid/q", full_sentence: "One sentence.", context: "A report." }],
    model: {
      x402_over_intents_30d_display: "0.040%",
      fee_rate: 0.001625,
      table: [1, 10, 100, 1000].flatMap((multiple) =>
        [0.01, 0.1, 0.5].map((pass_through) => ({
          multiple,
          pass_through,
          annual_near_usd: multiple === 1 && pass_through === 0.01 ? 50.537 : 1000,
        })),
      ),
    },
  };
  const out = renderTemplate(
    "{{model.ratio}} {{model.fee_rate}}\n{{model.table}}\n{{n:vet402.attempts}} {{range:vet402.attempts}} {{asof:vet402.attempts}} {{source:vet402.attempts}}\n{{breakdown.table}}\n{{definitions.table}}\n{{quotes.table}}\n{{snapshot.sha256}} {{snapshot.retrieved_at}}\n",
    thesis,
  );
  assert.match(out, /^0\.040% 0\.1625%/);
  assert.match(out, /\| 1x \| \$51 \| \$1,000 \| \$1,000 \|/);
  assert.match(out, /18,683 from 2026-08-14 09:54 to 2026-10-29 21:32 2026-10-29 22:04 vet402_export/);
  assert.match(out, /\| 1-not-settled \| settle_failed \| payer_unfunded \| false \| false \| 1,032 \|/);
  assert.ok(out.indexOf("1-not-settled") < out.indexOf("3-settled"));
  assert.match(out, /\| attempt \| A row whose network is non-empty\. \|/);
  assert.match(out, /\| q \| One sentence\. \| https:\/\/example\.invalid\/q \| A report\. \|/);
  assert.match(out, /abc 2026-10-29T22:04:40\.090Z/);
});
