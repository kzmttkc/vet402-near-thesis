import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { countMissing, formatValue, isMissingRecord, renderDashboard, sourceIndex, X402_ALL_URL, X402_BASE_URL, EXPORT_URL, DEFILLAMA_URL, FASTNEAR_ACCOUNT_URL, NEARBLOCKS_FT_URL, BASE_RPC_URL } from "../docs/app.js";
import { PREREGISTERED_POST } from "../docs/live.mjs";
import { PREREG_RECORD, replayLabel } from "../docs/prereg.mjs";
import { x402Url } from "../lib/sources/x402scan.mjs";
import { DEFILLAMA_URL as LLAMA } from "../lib/sources/defillama.mjs";
import { EXPORT_URL as THESIS_EXPORT } from "../thesis.mjs";
import { DEFAULT_RPCS } from "../lib/sources/vault.mjs";
import { FASTNEAR_TX_ORIGIN } from "../lib/sources/fastnear-census.mjs";
import { URLS } from "../lib/sources/near.mjs";

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

test("dashboard citations use the same public URLs as the fetchers", () => {
  assert.equal(X402_ALL_URL, x402Url("all"));
  assert.equal(X402_BASE_URL, x402Url("base"));
  assert.equal(EXPORT_URL, THESIS_EXPORT);
  assert.equal(DEFILLAMA_URL, LLAMA);
  assert.equal(FASTNEAR_ACCOUNT_URL, `${FASTNEAR_TX_ORIGIN}/v0/account`);
  assert.equal(NEARBLOCKS_FT_URL, URLS.usdc_receipts);
  assert.equal(BASE_RPC_URL, DEFAULT_RPCS[2]);
});

test("dashboard page states the question and does not pull a CDN", () => {
  const html = readFileSync(join(ROOT, "docs", "index.html"), "utf8");
  const js = readFileSync(join(ROOT, "docs", "app.js"), "utf8");
  assert.match(html, /x402 on NEAR, counted before the verdict\./);
  assert.match(html, /Fragment Mono/);
  assert.match(html, /Martian Mono/);
  assert.doesNotMatch(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /overflow-x:\s*auto/);
  assert.match(html, /overflow-x:\s*hidden/);
  assert.match(html, /\.meter-track/);
  assert.match(js, /threshold-meter/);
  assert.match(js, /Lower bound retrieved/);
  assert.match(js, /Pre-registered threshold/);
  assert.doesNotMatch(html, /https?:\/\//);
  const prose = `${html}\n${js}`.replaceAll("en-US", "");
  assert.doesNotMatch(prose, /—|–/);
  assert.doesNotMatch(prose, /\b(we|our|us)\b/i);
});

function textOf(node) {
  const own = node.textContent ?? "";
  const nested = (node.children ?? []).map(textOf).join(" ");
  return `${own} ${nested}`.replace(/\s+/g, " ").trim();
}

function findDescendant(node, pred) {
  if (pred(node)) return node;
  for (const child of node.children ?? []) {
    const found = findDescendant(child, pred);
    if (found) return found;
  }
  return null;
}

test("the facilitator table lines the five accounts up together", () => {
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
      for (const child of node.children ?? []) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  };
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: (tag) => new El(tag) };
  globalThis.Node = class Node {};
  const root = new El("main");
  const h1 = new El("h1");
  root.append(h1);
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  const sources = sourceIndex(JSON.parse(readFileSync(join(ROOT, "data/snapshot/near/facilitators.json"), "utf8")));
  try {
    renderDashboard(root, thesis, null, { sources, preregDigest: PREREG_RECORD.digest });
  } finally {
    globalThis.document = previousDocument;
  }
  const page = textOf(root);
  const accounts = Number(thesis.numbers["near.known.accounts"].value).toLocaleString("en-US");
  const exact = Number(thesis.numbers["near.known.named_delegate"].value).toLocaleString("en-US");
  const line = Number(thesis.numbers["threshold.line"].value).toLocaleString("en-US");
  assert.match(page, new RegExp(`${exact} exact-scheme payments from the named facilitators in 30 days\\. The ${line} line was posted on chain before the count`));
  assert.match(page, new RegExp(`${accounts} accounts are on the roster\\. A facilitator sees only its own account\\. These cards line them up together\\.`));
  assert.ok(page.includes(replayLabel(PREREG_RECORD.at)));
  assert.match(page, /Replay of the frozen record\. This page does not call an RPC\./);
  assert.match(page, new RegExp(PREREG_RECORD.tx));
  assert.match(page, /sha256 of PREREG\.md matches the posted digest/);
  assert.match(page, /Figure 1\. Lower bound on N and the posted line/);
  assert.match(page, /api\.solvador\.com/);
  assert.match(page, /usdc-delegate-sample\.json/);
  assert.doesNotMatch(page, /Five facilitators/);
  for (const account of [
    "x402-relayer2.mike.near",
    "x402-relayer.mike.near",
    "solvador.near",
    "uvd-facilitator.near",
    "5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c",
  ]) {
    assert.match(page, new RegExp(account));
  }
  assert.match(page, /Not named by \/supported/);
  assert.match(page, /exact x402 settlements \(30 days\)/);
  assert.match(page, /other activity/);
  assert.match(page, /51 \(14 ft_transfer_call, 37 escrow calls\)\. Not classified\./);
  assert.match(page, /not x402/);
  assert.match(page, /Command: node thesis\.mjs --fetch-relays\. Source URL: https:\/\/tx\.main\.fastnear\.com\/v0\/account/);
  assert.match(page, /Command: node thesis\.mjs --offline\. Source URL: https:\/\/vet402\.com\/api\/v1\/observatory\/export\.csv\?days=365/);
  assert.match(page, /Command: node thesis\.mjs --fetch-vault\. Source URL: https:\/\/mainnet\.base\.org/);
  assert.match(page, /Command: node thesis\.mjs --fetch-near\. Source URL: https:\/\/api\.nearblocks\.io\/v3\/accounts\/17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1\/receipts\?method=ft_transfer/);
  assert.match(page, /14 Delegate ft_transfer_call to NEAR USDC and 37 calls on v1\.arras-escrow\.near/);
  assert.match(page, /Not classified as x402 or as not x402/);
  assert.doesNotMatch(page, /Escrow movements, not a Delegate USDC ft_transfer/);
  assert.match(page, /1,716/);
  const tableWrap = root.children.find((node) => node.className === "table-scroll");
  assert.equal(tableWrap.className, "table-scroll");
  const blank = structuredClone(thesis);
  delete blank.near.known.roster;
  const empty = new El("main");
  empty.append(new El("h1"));
  globalThis.document = { createElement: (tag) => new El(tag) };
  globalThis.Node = class Node {};
  try {
    renderDashboard(empty, blank, null);
  } finally {
    globalThis.document = previousDocument;
  }
  assert.match(textOf(empty), /missing/);
});

test("docs copies match the files the page can fetch, and a miss hides the zero", () => {
  const prereg = readFileSync(join(ROOT, "PREREG.md"));
  const preregCopy = readFileSync(join(ROOT, "docs", "PREREG.md"));
  assert.deepEqual(preregCopy, prereg);
  const facilitators = readFileSync(join(ROOT, "data", "snapshot", "near", "facilitators.json"));
  assert.deepEqual(readFileSync(join(ROOT, "docs", "facilitators.json")), facilitators);
  const js = readFileSync(join(ROOT, "docs", "app.js"), "utf8");
  assert.match(js, /new URL\("\.\/PREREG\.md"/);
  assert.match(js, /new URL\("\.\/facilitators\.json"/);
  assert.doesNotMatch(js, /\.\.\/PREREG\.md/);
  assert.doesNotMatch(js, /\.\.\/data\/snapshot\/near\/facilitators\.json/);

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
  El.prototype.querySelector = function () {
    return null;
  };
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  globalThis.document = { createElement: (tag) => new El(tag) };
  globalThis.Node = class Node {};
  const root = new El("main");
  const thesis = JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
  try {
    renderDashboard(root, thesis, null, { preregDigest: null, sources: null });
  } finally {
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
  }
  const page = textOf(root);
  assert.match(page, /Evidence files were not loaded/);
  assert.doesNotMatch(page, /Incomplete numbers: 0/);
  assert.match(page, /Source missing/);
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
  const title = findDescendant(root, (node) => node.tag === "h1");
  assert.equal(title.textContent, "x402 on NEAR, counted before the verdict.");
  const meter = findDescendant(root, (node) => node.id === "threshold-meter");
  assert.equal(meter.id, "threshold-meter");
  const track = meter.children.find((node) => node.className === "meter-track");
  assert.ok(track, "one bar");
  const marks = track.children.map((node) => node.className);
  assert.deepEqual(marks, ["meter-fill", "meter-line", "meter-mark lower"]);
  const left = Object.fromEntries(
    track.children
      .filter((node) => typeof node.style.left === "string" && node.style.left.includes("%"))
      .map((node) => [node.className, Number(node.style.left.replace("%", ""))]),
  );
  assert.ok(left["meter-mark lower"] < left["meter-line"]);
  assert.equal(left["meter-line"], 100);
  const text = meter.children.map((node) => node.textContent).join("\n");
  assert.match(text, /Lower bound retrieved 2026-11-07 12:47 UTC/);
  assert.match(text, /Window ends 2026-11-07 11:42 UTC/);
  assert.match(text, /Line retrieved 2026-10-29 23:18 UTC/);
  assert.doesNotMatch(text, /04:24/);
  assert.match(text, /Frozen snapshot/);
  assert.match(text, /Lower, known relays 1,716 = lower bound on N/);
  assert.match(text, /1,716 is 6\.8% of the line/);
  assert.match(text, /not decided/);
  assert.doesNotMatch(text, /20,421/);
  assert.doesNotMatch(text, /42,675/);
  assert.match(text, /Line 25,400/);
  const page = textOf(root);
  assert.match(page, /Biased sample estimate\. Reference only\. Not used in the claim\./);
  assert.match(page, /20,421/);
  assert.match(page, /42,675/);
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
  const liveMeter = findDescendant(root, (node) => node.id === "threshold-meter");
  const liveText = liveMeter.children.map((node) => node.textContent).join("\n");
  assert.match(liveText, /Lower bound retrieved 2026-11-08 00:30 UTC/);
  assert.match(liveText, /Line retrieved 2026-10-29 23:18 UTC/);
  assert.match(liveText, /Daily reading/);
  assert.match(liveText, /Lower 18,000/);
  assert.doesNotMatch(liveText, /sample hits/);
  globalThis.document = previousDocument;
  globalThis.Node = previous;
});
