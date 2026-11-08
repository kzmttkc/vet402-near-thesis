import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { formatValue, renderDashboard } from "../docs/app.js";
import { PREREG_RECORD } from "../docs/prereg.mjs";

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

function countTag(node, tag) {
  if (node == null || typeof node !== "object") return 0;
  let count = node.tag === tag ? 1 : 0;
  for (const child of node.children ?? []) count += countTag(child, tag);
  return count;
}

function mount() {
  function El(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.rel = "";
    this.href = "";
    this.attrs = {};
  }
  El.prototype.append = function (...nodes) {
    this.children.push(...nodes);
  };
  El.prototype.replaceChildren = function () {
    this.children = [];
  };
  El.prototype.setAttribute = function (name, value) {
    this.attrs[name] = String(value);
    if (name === "class") this.className = String(value);
  };
  El.prototype.querySelector = function () {
    return null;
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

function render(thesis, bq) {
  const mounted = mount();
  try {
    renderDashboard(mounted.root, thesis, null, {
      bq,
      sources: { account: [] },
      preregDigest: PREREG_RECORD.digest,
    });
    return textOf(mounted.root);
  } finally {
    mounted.restore();
  }
}

test("the dashboard shows the upper-bound query, 31 daily bars, and the verdict from thesis.json", () => {
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  const bq = JSON.parse(readFileSync(join(ROOT, "data", "snapshot", "near", "bigquery-n-upper-bound.json"), "utf8"));
  assert.deepEqual(readFileSync(join(ROOT, "docs", "bigquery-n-upper-bound.json")), readFileSync(join(ROOT, "data", "snapshot", "near", "bigquery-n-upper-bound.json")));
  const upperText = formatValue(thesis.numbers["near.bq.n_upper_bound"]);
  const lineText = formatValue(thesis.numbers["threshold.line"]);
  const sumText = formatValue(thesis.numbers["near.bq.sum_of_daily"]);
  const spanText = formatValue(thesis.numbers["near.bq.receipts_on_two_dates"]);
  const days = thesis.numbers["near.bq.minute_window"].range.days;
  assert.equal(upperText, "2,532");
  assert.equal(lineText, "25,400");
  assert.equal(sumText, "2,534");
  assert.equal(spanText, "2");
  assert.equal(days, 30);
  assert.equal(bq.days.length, 31);
  assert.equal(bq.days.reduce((sum, day) => sum + day.matched, 0), 2534);

  const mounted = mount();
  let page = "";
  try {
    renderDashboard(mounted.root, thesis, null, {
      bq,
      sources: { account: [] },
      preregDigest: PREREG_RECORD.digest,
    });
    page = textOf(mounted.root);
    assert.equal(countTag(mounted.root, "rect"), 31);
    const queryNode = walk(mounted.root).find((node) => node.className === "meta" && textOf(node).includes("job_9RryoOYvLbEXZ1Emk9d0ThJ273x2"));
    const query = queryNode ? textOf(queryNode) : "";
    assert.ok(queryNode);
    assert.equal(query.includes("@"), false);
    assert.equal(query.includes("us-east1"), false);
    assert.equal(query.includes("bigquery-public-data"), false);
  } finally {
    mounted.restore();
  }

  const wholeUrl = "https://github.com/kzmttkc/vet402-near-thesis/blob/main/sql/n-upper-bound.sql";
  const dailyUrl = "https://github.com/kzmttkc/vet402-near-thesis/blob/main/sql/n-upper-bound-daily.sql";
  assert.ok(page.includes(wholeUrl));
  assert.ok(page.includes(dailyUrl));
  assert.ok(page.includes("job_9RryoOYvLbEXZ1Emk9d0ThJ273x2"));
  assert.ok(page.includes("job_P2IOUNAwg1YB614m6IbO97J1B8BV"));
  assert.ok(page.includes("2026-11-07 21:04 UTC"));
  assert.ok(page.includes("2026-11-07 21:07 UTC"));
  assert.ok(page.includes("Figure 1. Lower bound on N and the posted line"));
  assert.ok(page.includes("Figure 2. Daily matched receipts."));
  assert.ok(page.indexOf("Figure 1. Lower bound on N and the posted line") < page.indexOf("Figure 2. Daily matched receipts."));
  assert.ok(page.includes(`The daily counts sum to ${sumText} and the whole-date upper bound is ${upperText}, because ${spanText} receipts appear on two dates.`));
  assert.ok(page.includes(`N ≤ ${upperText} < ${lineText} over all ${days} days: the threshold is not crossed.`));
  assert.equal(page.includes("marine"), false);
  assert.equal(page.includes("@gmail"), false);
  assert.equal(page.includes("kzmttkc314"), false);

  const shifted = structuredClone(thesis);
  shifted.numbers["near.bq.n_upper_bound"] = { ...shifted.numbers["near.bq.n_upper_bound"], value: 1 };
  shifted.numbers["threshold.line"] = { ...shifted.numbers["threshold.line"], value: 25400 };
  const shiftedPage = render(shifted, null);
  assert.ok(shiftedPage.includes("N ≤ 1 < 25,400 over all 30 days: the threshold is not crossed."));
  assert.equal(shiftedPage.includes("N ≤ 2,532 < 25,400 over all 30 days: the threshold is not crossed."), false);
  assert.equal(shiftedPage.includes("Figure 2. Daily matched receipts."), false);
});

test("refresh can be started by hand and keeps the daily schedule", () => {
  const yaml = readFileSync(join(ROOT, ".github", "workflows", "refresh.yml"), "utf8");
  assert.match(yaml, /^ {2}workflow_dispatch:/m);
  assert.match(yaml, /cron: "30 0 \* \* \*"/);
});
