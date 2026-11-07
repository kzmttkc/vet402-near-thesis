import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { countMissing, formatValue, isMissingRecord, renderDashboard } from "../docs/app.js";
import { PREREGISTERED_POST } from "../docs/live.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("countMissing counts numbers that lack range, date, or source", () => {
  const complete = {
    value: 1,
    range: { from: "2026-08-14T00:00:00Z", to: "2026-10-29T00:00:00Z" },
    as_of: "2026-10-29T00:00:00Z",
    source: "vet402_export",
  };
  assert.equal(isMissingRecord(complete), false);
  assert.equal(isMissingRecord({ ...complete, range: undefined }), true);
  assert.equal(isMissingRecord({ ...complete, as_of: "" }), true);
  assert.equal(isMissingRecord({ ...complete, source: null }), true);
  assert.equal(isMissingRecord({ ...complete, range: {} }), true);
  assert.equal(isMissingRecord({ value: 3, range: { days: 30, to: "2026-10-29T00:00:00Z" }, as_of: "t" }), true);
  assert.equal(countMissing([
    complete,
    { value: 2 },
    { value: 3, range: { days: 30, to: "2026-10-29T00:00:00Z" }, as_of: "t" },
  ]), 2);
});

test("dashboard dollars follow unit_kind, so a USDC count stays a count", () => {
  assert.equal(formatValue({ value: 25400, unit: "NEAR delegate-action USDC transfers in 30 days", unit_kind: "count" }), "25,400");
  assert.equal(formatValue({ value: 41050145.312122, unit: "USD", unit_kind: "usd" }), "$41,050,145");
  assert.equal(formatValue({ value: 0.001, unit: "USDC", unit_kind: "usdc" }), "0.001");
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  for (const id of ["vet402.attempts", "vault.usdc_out_30d.count", "threshold.line", "near.delegate.transfers_30d"]) {
    assert.equal(formatValue(thesis.numbers[id]).includes("$"), false, id);
  }
  assert.equal(formatValue(thesis.numbers["vault.usdc_out_30d.usd"]).startsWith("$"), true);
});

test("dashboard page states the question and does not pull a CDN", () => {
  const html = readFileSync(join(ROOT, "docs", "index.html"), "utf8");
  const js = readFileSync(join(ROOT, "docs", "app.js"), "utf8");
  assert.match(html, /Where does NEAR fit in agent payments\? Numbers from one re-runnable script\./);
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /overflow-x:\s*auto/);
  assert.match(html, /overflow-x:\s*hidden/);
  assert.match(html, /\.meter-track/);
  assert.match(js, /threshold-meter/);
  assert.match(js, /Last updated/);
  assert.match(js, /Pre-registered threshold/);
  assert.doesNotMatch(html, /https?:\/\//);
  const prose = `${html}\n${js}`.replaceAll("en-US", "");
  assert.doesNotMatch(prose, /—|–/);
  assert.doesNotMatch(prose, /\b(we|our|us)\b/i);
});

test("the threshold bar leads the page and falls back to the frozen bounds", () => {
  function El(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.rel = "";
    this.href = "";
  }
  El.prototype.append = function (...nodes) {
    this.children.push(...nodes);
  };
  El.prototype.replaceChildren = function () {
    this.children = [];
  };
  El.prototype.querySelector = function (sel) {
    const walk = (node) => {
      if (sel === "h1" && node.tag === "h1") return node;
      if (sel === "#threshold-meter" && node.id === "threshold-meter") return node;
      for (const child of node.children ?? []) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  };
  const previous = globalThis.Node;
  globalThis.Node = class Node {};
  const root = new El("main");
  const h1 = new El("h1");
  h1.textContent = "Where does NEAR fit in agent payments? Numbers from one re-runnable script.";
  root.append(h1);
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: (tag) => new El(tag) };
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  try {
    renderDashboard(root, thesis, null);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Node = previous;
  }
  assert.equal(root.children[0].tag, "h1");
  const meter = root.children[1];
  assert.equal(meter.id, "threshold-meter");
  const track = meter.children.find((node) => node.className === "meter-track");
  assert.ok(track, "one bar");
  const marks = track.children.map((node) => node.className);
  assert.deepEqual(marks, ["meter-line", "meter-mark lower", "meter-mark estimate", "meter-mark upper"]);
  const left = Object.fromEntries(track.children.map((node) => [node.className, Number(node.style.left.replace("%", ""))]));
  assert.ok(left["meter-mark lower"] < left["meter-mark estimate"]);
  assert.ok(left["meter-mark estimate"] < left["meter-line"]);
  assert.ok(left["meter-line"] < left["meter-mark upper"]);
  const text = meter.children.map((node) => node.textContent).join("\n");
  assert.match(text, /Last updated 2026-11-07 04:24 UTC/);
  assert.match(text, /Frozen snapshot/);
  assert.match(text, /Lower, sample hits 5/);
  assert.match(text, /Estimate 20,421/);
  assert.match(text, /Upper 42,675/);
  assert.match(text, /Line 25,400/);
  const anchor = meter.children.flatMap((node) => node.children ?? []).find((node) => node.tag === "a");
  assert.equal(anchor.href, PREREGISTERED_POST);
  assert.equal(anchor.textContent, "Pre-registered threshold");

  globalThis.document = { createElement: (tag) => new El(tag) };
  globalThis.Node = class Node {};
  renderDashboard(root, thesis, {
    date: "2026-11-08",
    updated: "2026-11-08T00:30:00.000Z",
    line: 25400,
    lower: 18000,
    lower_kind: "census",
    estimate: 24000,
    upper: 30000,
    relays_obtained: true,
    source: "live",
  });
  const liveText = root.children[1].children.map((node) => node.textContent).join("\n");
  assert.match(liveText, /Last updated 2026-11-08 00:30 UTC/);
  assert.match(liveText, /Daily reading/);
  assert.match(liveText, /Lower 18,000/);
  assert.doesNotMatch(liveText, /sample hits/);
  globalThis.document = previousDocument;
  globalThis.Node = previous;
});
