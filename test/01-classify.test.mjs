import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { classify, KNOWN_TRIPLES } from "../lib/classify.mjs";
import { parseCsv } from "../lib/csv.mjs";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "tiny.csv");

const KNOWN = [
  { status: "no_eligible_accept", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "over_cap", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "no_402", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "price_mismatch", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "no_fee_payer", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "payto_mismatch", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "settle_failed", held_reason: "unsettled_4xx", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_failed", held_reason: "", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_failed", held_reason: "payer_unfunded", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_claim_refuted", held_reason: "", networkEmpty: false, category: "1-not-settled" },
  { status: "delivered_no_receipt", held_reason: "", networkEmpty: false, category: "2-pending" },
  { status: "settle_claimed", held_reason: "", networkEmpty: false, category: "2-pending" },
  { status: "settled", held_reason: "", networkEmpty: false, category: "3-settled" },
  { status: "settled", held_reason: "settled_4xx", networkEmpty: false, category: "3-settled" },
];

test("known 14 triples map uniquely onto ①–④", () => {
  assert.equal(KNOWN.length, 14);
  assert.equal(KNOWN_TRIPLES.length, 14);
  const seen = new Set();
  for (const spec of KNOWN) {
    const key = `${spec.status}\0${spec.held_reason}\0${spec.networkEmpty ? "empty" : "set"}`;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
    const got = classify({
      status: spec.status,
      held_reason: spec.held_reason,
      network: spec.networkEmpty ? "" : "near",
      http_status_paid: spec.status === "settled" && spec.held_reason === "" ? "200" : "400",
      tx_hash: "",
    });
    assert.equal(got.category, spec.category);
  }
});

test("unknown triple throws", () => {
  assert.throws(
    () => classify({ status: "mystery", held_reason: "", network: "near", http_status_paid: "200", tx_hash: "" }),
    /unknown combination/,
  );
  assert.throws(
    () => classify({ status: "settled", held_reason: "payer_unfunded", network: "near", http_status_paid: "200", tx_hash: "" }),
    /unknown combination/,
  );
  assert.throws(
    () => classify({ status: "no_eligible_accept", held_reason: "", network: "near", http_status_paid: "400", tx_hash: "" }),
    /unknown combination/,
  );
});

test("settled+empty splits delivered vs unexplained by 2xx; settled_4xx is held", () => {
  const delivered = classify({ status: "settled", held_reason: "", network: "near", http_status_paid: "202", tx_hash: "tx" });
  assert.equal(delivered.delivered, true);
  assert.equal(delivered.unexplained, false);
  assert.equal(delivered.held, false);
  assert.equal(delivered.http_2xx, true);

  const unexplained = classify({ status: "settled", held_reason: "", network: "near", http_status_paid: "500", tx_hash: "tx" });
  assert.equal(unexplained.delivered, false);
  assert.equal(unexplained.unexplained, true);
  assert.equal(unexplained.held, false);

  const emptyHttp = classify({ status: "settled", held_reason: "", network: "near", http_status_paid: "", tx_hash: "tx" });
  assert.equal(emptyHttp.delivered, false);
  assert.equal(emptyHttp.unexplained, true);

  const held = classify({ status: "settled", held_reason: "settled_4xx", network: "near", http_status_paid: "400", tx_hash: "tx" });
  assert.equal(held.held, true);
  assert.equal(held.delivered, false);
  assert.equal(held.unexplained, false);
  assert.equal(held.settled, true);
});

test("tiny fixture CSV: 14 triples classify; quoted comma and newline survive parse", async () => {
  const text = await readFile(FIXTURE, "utf8");
  const { headers, rows } = parseCsv(text);
  assert.equal(headers[0], "attempted_at");
  assert.equal(rows.length, 16);
  const bodyWithNl = rows.find((r) => r.resource_key === "https://example.test/k03");
  assert.equal(bodyWithNl.request_body, "line1\nline2");
  const bodyWithComma = rows.find((r) => r.resource_key === "https://example.test/k11");
  assert.equal(bodyWithComma.request_body, "hello, world");
  const jsonBody = rows.find((r) => r.resource_key === "https://example.test/k01");
  assert.equal(jsonBody.request_body, '{"a":1}');

  const cats = new Set();
  for (const row of rows) {
    const got = classify(row);
    cats.add(got.category);
  }
  assert.deepEqual([...cats].sort(), ["1-not-settled", "2-pending", "3-settled", "4-not-an-attempt"]);
});
