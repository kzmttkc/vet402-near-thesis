import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { renderDashboard, showsDailyReading } from "../docs/app.js";
import { intentsFromBody } from "../lib/sources/defillama.mjs";
import { closeIntentsVolume30d } from "../thesis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function textOf(node) {
  if (node == null || typeof node !== "object") return "";
  const own = node.textContent ?? "";
  const nested = (node.children ?? []).map(textOf).join(" ");
  return `${own} ${nested}`.replace(/\s+/g, " ").trim();
}

function walk(node, acc = []) {
  if (node == null || typeof node !== "object") return acc;
  acc.push(node);
  for (const child of node.children ?? []) walk(child, acc);
  return acc;
}

function mount() {
  function El(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.className = "";
    this.id = "";
    this.textContent = "";
  }
  El.prototype.append = function (...nodes) {
    this.children.push(...nodes);
  };
  El.prototype.replaceChildren = function () {
    this.children = [];
  };
  El.prototype.setAttribute = function (name, value) {
    if (name === "class") this.className = String(value);
  };
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  globalThis.document = { createElement: (tag) => new El(tag) };
  globalThis.Node = class Node {};
  const root = new El("main");
  return {
    root,
    restore() {
      globalThis.document = previousDocument;
      globalThis.Node = previousNode;
    },
  };
}

test("0.040% matches the frozen snapshot at the published rounding", async () => {
  const all = JSON.parse(await readFile(join(ROOT, "data/snapshot/x402scan/all.json"), "utf8"));
  const usd = all.result.data.json.total_amount / 1e6;
  assert.equal(Math.round(usd), 1_579_185);
  const body = await readFile(join(ROOT, "data/snapshot/defillama-near-intents.json"), "utf8");
  const meta = JSON.parse(await readFile(join(ROOT, "data/snapshot/defillama-near-intents.meta.json"), "utf8"));
  const got = intentsFromBody(body, meta.retrieved_at);
  const closed = closeIntentsVolume30d(got.numbers["intents.volume_30d"].range);
  assert.equal(got.volume_30d, 3_965_443_376);
  assert.equal(closed.from.slice(0, 10), "2026-09-29");
  assert.equal(closed.to.slice(0, 10), "2026-10-29");
  assert.equal(((usd / got.volume_30d) * 100).toFixed(3), "0.040");
  assert.equal(((1_579_185 / 3_965_443_376) * 100).toFixed(3), "0.040");
  const sentence = "0.040% = 1,579,185 / 3,965,443,376.";
  const windowLine = "DefiLlama totalDataChart, 2026-09-29 to 2026-10-29 UTC.";
  for (const name of ["README.tmpl.md", "README.md", "THESIS.tmpl.md", "THESIS.md"]) {
    const text = await readFile(join(ROOT, name), "utf8");
    if (name.startsWith("THESIS")) assert.ok(text.includes(sentence), name);
    assert.ok(text.includes(windowLine), name);
  }
});

test("the band names a daily reading only for a new count, and shows the upper-bound query", () => {
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs/thesis.json"), "utf8"));
  const live = JSON.parse(readFileSync(join(ROOT, "docs/live.json"), "utf8"));
  const sql = readFileSync(join(ROOT, "sql/n-upper-bound.sql"), "utf8");
  // A frozen reading: the daily file has no new census and keeps the BigQuery bound. The real live.json changes every day.
  const frozen = { ...live, relays_obtained: false, upper: thesis.numbers["near.bq.n_upper_bound"].value };
  assert.equal(showsDailyReading(frozen, thesis), false);
  assert.equal(showsDailyReading({ ...frozen, relays_obtained: true }, thesis), true);
  assert.equal(showsDailyReading({ ...frozen, upper: 3_000 }, thesis), true);
  assert.equal(showsDailyReading(null, thesis), false);

  const mounted = mount();
  try {
    renderDashboard(mounted.root, thesis, frozen, { bq: null, sources: { account: [] }, preregDigest: "abc", querySql: sql });
    const page = textOf(mounted.root);
    assert.ok(page.includes("Frozen snapshot · read in-block"));
    assert.equal(page.includes("Daily reading · read in-block"), false);
    assert.ok(page.includes("The daily file keeps the frozen bounds until a new full count arrives. The number that decides the claim is 2,532."));
    assert.ok(page.includes("The inner ft_transfer receipt is not required to succeed, so this count is at least N."));
    assert.ok(page.includes("Query behind this number"));
    assert.ok(page.includes("DefiLlama totalDataChart, 2026-09-29 to 2026-10-29 UTC."));
    const pre = walk(mounted.root).find((node) => node.className === "query-sql");
    assert.equal(pre.textContent, sql);
  } finally {
    mounted.restore();
  }

  const again = mount();
  try {
    renderDashboard(again.root, thesis, { ...live, relays_obtained: true, source: "live" }, { sources: { account: [] }, preregDigest: "abc" });
    assert.ok(textOf(again.root).includes("Daily reading · read in-block"));
  } finally {
    again.restore();
  }
});

test("the pages copy of the upper-bound query matches the source file", () => {
  const source = readFileSync(join(ROOT, "sql/n-upper-bound.sql"), "utf8");
  const copy = readFileSync(join(ROOT, "docs/sql/n-upper-bound.sql"), "utf8");
  assert.equal(copy, source);
});
