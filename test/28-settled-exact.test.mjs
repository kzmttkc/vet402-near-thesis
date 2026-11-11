import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { renderDashboard } from "../docs/app.js";
import { relayerKind } from "../lib/sources/near.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HASH = "2AzhbSqm1nT5QizVBmas3xFisNiqx9upYnKbGfReWnb5";
const WINDOW_FROM = "2026-10-08";
const WINDOW_TO = "2026-11-07";

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatUtc(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function isoFromNs(ns) {
  return new Date(Number(BigInt(ns) / 1_000_000n)).toISOString();
}

function usdcText(amountRaw) {
  const text = (Number(amountRaw) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return text === "" ? "0" : text;
}

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

test("the relayer card counts the exact payments that settled before the window, from the frozen json", () => {
  const raw = JSON.parse(readFileSync(join(ROOT, "data/snapshot/near/relayer-payments.json"), "utf8"));
  const payment = raw.payments.find((item) => item.hash === HASH);
  assert.ok(payment);
  assert.equal(payment.signer_id, "x402-relayer2.mike.near");
  assert.equal(payment.sender_id, "mike.near");
  assert.equal(payment.ft_receiver, "count.mike.near");
  assert.equal(payment.method, "ft_transfer");
  assert.equal(payment.amount_raw, "1000");
  assert.equal(payment.inner_success, true);

  const receipts = JSON.parse(readFileSync(join(ROOT, "data/snapshot/near/relayer-receipts.json"), "utf8"));
  const rows = receipts.rows.filter((row) => row.transaction_hash === payment.hash && relayerKind(row) === "payment");
  assert.equal(rows.length, 1);
  const at = isoFromNs(rows[0].block.block_timestamp);
  const day = at.slice(0, 10);
  assert.equal(day >= WINDOW_FROM && day <= WINDOW_TO, false, at);
  assert.ok(at < `${WINDOW_FROM}T00:00:00.000Z`, at);

  const thesis = JSON.parse(readFileSync(join(ROOT, "docs/thesis.json"), "utf8"));
  const joined = thesis.near.relayer.payments.find((item) => item.hash === payment.hash);
  assert.equal(joined.at, at);
  assert.equal(joined.sender_id, payment.sender_id);
  assert.equal(joined.ft_receiver, payment.ft_receiver);
  assert.equal(joined.amount_usdc, Number(payment.amount_raw) / 1e6);
  assert.equal(joined.inner_success, true);
  assert.ok(at < thesis.near.known.window.from);

  const amount = usdcText(payment.amount_raw);
  const before = thesis.near.relayer.payments.filter((item) => item.inner_success === true && item.at < thesis.near.known.window.from);
  assert.equal(before.length, 6);
  const line = `${before.length} exact payments settled before this window, ${amount} USDC each, inner receipt succeeded. The last was ${formatUtc(at)}, hash ${payment.hash.slice(0, 8)}…${payment.hash.slice(-4)}.`;

  const mounted = mount();
  try {
    renderDashboard(mounted.root, thesis, null, { sources: { "x402-relayer2.mike.near": [] }, preregDigest: "abc" });
    const cards = walk(mounted.root).filter((node) => node.tag === "article" && node.className === "card exhibit");
    const own = cards.find((card) => card.children.some((child) => child.tag === "h3" && child.textContent === payment.signer_id));
    assert.ok(own);
    const paragraph = own.children.find((child) => child.textContent === line);
    assert.ok(paragraph, textOf(own));
    const hits = cards.filter((card) => textOf(card).includes("exact payments settled before this window"));
    assert.deepEqual(hits.map((card) => card.children.find((child) => child.tag === "h3")?.textContent), [payment.signer_id]);
  } finally {
    mounted.restore();
  }
});
