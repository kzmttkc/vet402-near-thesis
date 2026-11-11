import { PREREGISTERED_POST, meterFromLive } from "./live.mjs";
import { PREREG_RECORD, replayLabel, replaySteps } from "./prereg.mjs";

export function isMissingRecord(rec) {
  if (rec == null || typeof rec !== "object") return true;
  const range = rec.range;
  const hasRange = range != null && range !== "" && !(typeof range === "object" && !Array.isArray(range) && Object.keys(range).length === 0);
  const hasDate = rec.as_of != null && String(rec.as_of).trim() !== "";
  const hasSource = rec.source != null && String(rec.source).trim() !== "";
  return !(hasRange && hasDate && hasSource);
}

export function countMissing(records) {
  let count = 0;
  for (const rec of records) {
    if (isMissingRecord(rec)) count += 1;
  }
  return count;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatUtc(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function formatRange(range) {
  if (range == null || typeof range !== "object") return "";
  const hasFrom = range.from != null && range.from !== "";
  const hasTo = range.to != null && range.to !== "";
  if (hasFrom && hasTo) return `from ${formatUtc(range.from)} to ${formatUtc(range.to)}`;
  if (range.from_block != null && range.to_block != null && !hasFrom && !hasTo) {
    return `blocks ${range.from_block} to ${range.to_block}`;
  }
  if (range.days != null && hasTo) return `${range.days} days to ${formatUtc(range.to)}`;
  if (range.all_time === true && hasTo) return `all time to ${formatUtc(range.to)}`;
  return "";
}

function formatShare(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatUsdInteger(value) {
  const number = Math.round(Number(value));
  const sign = number < 0 ? "-" : "";
  return `${sign}$${Math.abs(number).toLocaleString("en-US")}`;
}

function formatCount(value) {
  return Math.round(Number(value)).toLocaleString("en-US");
}

function unitKind(rec) {
  if (typeof rec?.unit_kind === "string" && rec.unit_kind !== "") return rec.unit_kind;
  const unit = String(rec?.unit ?? "");
  if (/share/i.test(unit)) return "share";
  if (unit === "USD") return "usd";
  if (unit === "USDC") return "usdc";
  return "count";
}

export function formatValue(rec) {
  if (rec == null || !Number.isFinite(Number(rec.value))) return null;
  const value = Number(rec.value);
  const kind = unitKind(rec);
  if (kind === "share") return formatShare(value);
  if (kind === "usd") return formatUsdInteger(value);
  if (kind === "usdc") {
    const text = value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    return text === "" ? "0" : text;
  }
  return formatCount(value);
}

function el(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  parent.append(node);
  return node;
}

function metaLine(parent, label, text, absent) {
  const p = el(parent, "p", "meta");
  p.append(`${label} `);
  el(p, "span", absent ? "missing" : null, absent ? "missing" : text);
}

export const X402_ALL_URL =
  "https://www.x402scan.com/api/trpc/public.stats.overall?input=%7B%22json%22%3A%7B%22timeframe%22%3A30%7D%7D";
export const X402_BASE_URL =
  "https://www.x402scan.com/api/trpc/public.stats.overall?input=%7B%22json%22%3A%7B%22timeframe%22%3A30%2C%22chain%22%3A%22base%22%7D%7D";
export const EXPORT_URL = "https://vet402.com/api/v1/observatory/export.csv?days=365";
export const DEFILLAMA_URL = "https://api.llama.fi/summary/dexs/near-intents";
export const FASTNEAR_ACCOUNT_URL = "https://tx.main.fastnear.com/v0/account";
export const NEARBLOCKS_FT_URL =
  "https://api.nearblocks.io/v3/accounts/17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1/receipts?method=ft_transfer";
export const BASE_RPC_URL = "https://mainnet.base.org";

export function provenanceFor(id) {
  if (id === "threshold.line" || id === "x402.base.share_amount_30d" || id === "x402.base.share_count_30d") {
    return { command: "node thesis.mjs --offline", url: X402_BASE_URL };
  }
  if (typeof id === "string" && id.startsWith("x402.")) return { command: "node thesis.mjs --offline", url: X402_ALL_URL };
  if (typeof id === "string" && id.startsWith("vet402.")) return { command: "node thesis.mjs --offline", url: EXPORT_URL };
  if (typeof id === "string" && id.startsWith("intents.")) return { command: "node thesis.mjs --offline", url: DEFILLAMA_URL };
  if (typeof id === "string" && id.startsWith("vault.")) return { command: "node thesis.mjs --fetch-vault", url: BASE_RPC_URL };
  if (typeof id === "string" && id.startsWith("near.known.")) return { command: "node thesis.mjs --fetch-relays", url: FASTNEAR_ACCOUNT_URL };
  if (typeof id === "string" && id.startsWith("near.delegate.")) return { command: "node thesis.mjs --fetch-near", url: NEARBLOCKS_FT_URL };
  if (id === "breakdown") return { command: "node thesis.mjs --offline", url: EXPORT_URL };
  if (id === "sensitivity" || id === "ratio") return { command: "node thesis.mjs --offline", url: `${X402_ALL_URL} ${DEFILLAMA_URL}` };
  return { command: "", url: "" };
}

function cite(parent, id) {
  const prov = provenanceFor(id);
  const command = prov.command || "";
  const url = prov.url || "";
  el(parent, "p", "meta", command && url ? `Command: ${command}. Source URL: ${url}` : "Command: missing. Source URL: missing");
}

let figureNo = 0;
let dailyCaption = null;

const SQL_BLOB = "https://github.com/kzmttkc/vet402-near-thesis/blob/main/";
const SQL_FILE = /^sql\/[a-z0-9.-]+\.sql$/;

function figure(parent, label, valueText, rec, id, underValue) {
  figureNo += 1;
  const box = el(parent, "figure", "figure");
  el(box, "p", "caption", `Figure ${figureNo}. ${label}`);
  const missingValue = valueText == null;
  el(box, "p", missingValue ? "value missing" : "value", missingValue ? "missing" : valueText);
  if (underValue) el(box, "p", "meta", underValue);
  const rangeText = formatRange(rec?.range);
  metaLine(box, "Range", rangeText, rangeText === "");
  const dateText = rec?.as_of != null && String(rec.as_of).trim() !== "" ? formatUtc(rec.as_of) : "";
  metaLine(box, "Retrieved", dateText, dateText === "");
  const sourceText = rec?.source != null && String(rec.source).trim() !== "" ? String(rec.source) : "";
  metaLine(box, "Source", sourceText, sourceText === "");
  cite(box, id);
}

function card(parent) {
  return el(parent, "article", "card");
}

function table(headers, rows) {
  const wrap = document.createElement("div");
  wrap.className = "table-scroll";
  const tableEl = document.createElement("table");
  const head = document.createElement("tr");
  for (const header of headers) {
    const th = document.createElement("th");
    th.textContent = header;
    head.append(th);
  }
  const thead = document.createElement("thead");
  thead.append(head);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell == null ? "" : String(cell);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tableEl.append(thead, tbody);
  wrap.append(tableEl);
  return wrap;
}

function sortedBreakdown(rows) {
  return [...rows].sort((a, b) => {
    return (
      String(a.category).localeCompare(String(b.category)) ||
      String(a.status).localeCompare(String(b.status)) ||
      String(a.held_reason ?? "").localeCompare(String(b.held_reason ?? "")) ||
      Number(Boolean(a.has_tx)) - Number(Boolean(b.has_tx)) ||
      Number(Boolean(a.http_2xx)) - Number(Boolean(b.http_2xx))
    );
  });
}

function sensitivityRows(model) {
  const multiples = [1, 10, 100, 1000];
  const passes = [0.01, 0.1, 0.5];
  const tableRows = model?.table;
  if (!Array.isArray(tableRows) || tableRows.length === 0) return null;
  return multiples.map((multiple) => {
    const cells = passes.map((pass) => {
      const row = tableRows.find((item) => item.multiple === multiple && item.pass_through === pass);
      if (!row || !Number.isFinite(Number(row.annual_near_usd))) return "missing";
      return formatUsdInteger(row.annual_near_usd);
    });
    return [`${multiple}x`, ...cells];
  });
}

function motionOn() {
  return typeof requestAnimationFrame === "function"
    && typeof matchMedia === "function"
    && !matchMedia("(prefers-reduced-motion: reduce)").matches
    && typeof performance !== "undefined";
}

function paintCount(node, value) {
  const target = Math.round(Number(value));
  if (!Number.isFinite(target)) {
    node.textContent = "missing";
    return;
  }
  const finalText = formatCount(target);
  if (!motionOn()) {
    node.textContent = finalText;
    return;
  }
  const start = performance.now();
  const duration = 800;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = formatCount(target * eased);
    if (t < 1) requestAnimationFrame(tick);
    else node.textContent = finalText;
  };
  node.textContent = formatCount(0);
  requestAnimationFrame(tick);
}

function shortId(value) {
  const text = String(value ?? "");
  if (text.length <= 28) return text;
  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}


function settledExactLine(payments, windowFrom) {
  const fromMs = new Date(windowFrom).getTime();
  if (!Array.isArray(payments) || !Number.isFinite(fromMs)) return "";
  const settled = payments
    .filter((item) => item?.inner_success === true && Number.isFinite(new Date(item.at).getTime()) && new Date(item.at).getTime() < fromMs)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (settled.length === 0) return "";
  const last = settled[settled.length - 1];
  if (typeof last.hash !== "string" || last.hash.length <= 28) return "";
  const amounts = new Set(settled.map((item) => item.amount_usdc));
  const amount = amounts.size === 1 ? formatValue({ value: last.amount_usdc, unit: "USDC", unit_kind: "usdc" }) : null;
  const each = amount == null ? "" : `, ${amount} USDC each`;
  return `${formatCount(settled.length)} exact payments settled before this window${each}, inner receipt succeeded. The last was ${formatUtc(last.at)}, hash ${shortId(last.hash)}.`;
}

const PREREG_VERIFY_URL = "https://github.com/kzmttkc/vet402-near-thesis/blob/main/PREREG-VERIFY.md";

function heroLead(thesis) {
  const exact = formatValue(thesis?.numbers?.["near.known.named_delegate"]);
  const line = formatValue(thesis?.numbers?.["threshold.line"]);
  const posted = formatUtc(PREREG_RECORD.at);
  if (exact == null || line == null) {
    return `The exact-scheme count is missing, and the line was posted on chain at ${posted}, before the count. `;
  }
  return `${exact} exact-scheme payments from the named facilitators in 30 days, and the ${line} line was posted on chain at ${posted}, before the count. `;
}

function censusWindowDays(thesis) {
  const known = Number(thesis?.numbers?.["near.known.lower"]?.range?.days);
  if (Number.isFinite(known)) return known;
  return Number(thesis?.numbers?.["near.bq.minute_window"]?.range?.days);
}

function verdictLine(thesis) {
  const upperRec = thesis?.numbers?.["near.bq.n_upper_bound"];
  const lineRec = thesis?.numbers?.["threshold.line"];
  const days = censusWindowDays(thesis);
  const dates = Number(thesis?.near?.bq?.dates_present);
  const upperText = formatValue(upperRec);
  const lineText = formatValue(lineRec);
  if (upperText == null || lineText == null || !Number.isFinite(days) || !Number.isFinite(dates)) return null;
  if (!(Number(upperRec.value) < Number(lineRec.value))) return null;
  return `N ≤ ${upperText} < ${lineText} over the ${formatCount(days)} days of the census window: the threshold is not crossed. BigQuery counts the ${formatCount(dates)} whole dates that contain the window.`;
}

// The chip says "Daily reading" only for a new count of N. A file that repeats the frozen BigQuery bound does not.
export function showsDailyReading(reading, thesis) {
  if (reading?.source !== "live") return false;
  if (reading.relays_obtained === true) return true;
  const frozen = Number(thesis?.numbers?.["near.bq.n_upper_bound"]?.value);
  const upper = Number(reading?.upper);
  return Number.isFinite(upper) && Number.isFinite(frozen) && upper !== frozen;
}

function defillamaWindowLine(rec) {
  const from = rec?.range?.from;
  const to = rec?.range?.to;
  if (typeof from !== "string" || typeof to !== "string" || from.length < 10 || to.length < 10) return null;
  return `DefiLlama totalDataChart, ${from.slice(0, 10)} to ${to.slice(0, 10)} UTC.`;
}

function renderHeroNote(post, thesis) {
  const note = el(post, "p", "hero-note");
  note.textContent = heroLead(thesis).trim();
  const verdict = verdictLine(thesis);
  if (verdict) el(post, "p", "hero-note verdict", verdict);
}

function svgEl(tag) {
  if (typeof document.createElementNS === "function") {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }
  return document.createElement(tag);
}

function attr(node, name, value) {
  if (typeof node.setAttribute === "function") node.setAttribute(name, value);
  else if (name === "class") node.className = value;
  else node[name] = value;
}

function dailyDiffSentence(thesis) {
  const sumText = formatValue(thesis?.numbers?.["near.bq.sum_of_daily"]);
  const upperText = formatValue(thesis?.numbers?.["near.bq.n_upper_bound"]);
  const spanText = formatValue(thesis?.numbers?.["near.bq.receipts_on_two_dates"]);
  if (sumText == null || upperText == null || spanText == null) return null;
  return `The daily counts sum to ${sumText} and the whole-date upper bound is ${upperText}, because ${spanText} receipts appear on two dates.`;
}

function renderQueryLine(parent, bq) {
  const jobs = Array.isArray(bq?.jobs) ? bq.jobs : [];
  const shown = jobs.filter((job) => SQL_FILE.test(String(job?.query_file ?? "")) && /^job_[A-Za-z0-9]+$/.test(String(job?.id ?? "")));
  if (shown.length === 0) return;
  const p = el(parent, "p", "meta");
  for (let index = 0; index < shown.length; index += 1) {
    const job = shown[index];
    if (index > 0) {
      const gap = document.createElement("span");
      gap.textContent = " ";
      p.append(gap);
    }
    const href = `${SQL_BLOB}${job.query_file}`;
    const link = document.createElement("a");
    link.href = href;
    link.rel = "noreferrer";
    link.textContent = href;
    p.append(link);
    const when = formatUtc(job.ran_at);
    const stamp = document.createElement("span");
    stamp.textContent = ` ${job.id} counted ${when}.`;
    p.append(stamp);
  }
}

function renderDailyChart(parent, thesis, bq) {
  const days = Array.isArray(bq?.days) ? bq.days.filter((day) => day && typeof day.block_date === "string") : [];
  if (days.length === 0) return;
  const box = el(parent, "figure", "figure");
  box.id = "daily-matched";
  dailyCaption = el(box, "p", "caption", "");
  const svg = svgEl("svg");
  attr(svg, "class", "day-chart");
  attr(svg, "role", "img");
  attr(svg, "viewBox", "0 0 640 156");
  attr(svg, "width", "100%");
  const title = svgEl("title");
  title.textContent = "Matched receipts on each whole date.";
  svg.append(title);
  const width = 640;
  const barTop = 16;
  const barBase = 120;
  const barArea = barBase - barTop;
  const gap = 2;
  const barW = (width - gap * (days.length - 1)) / days.length;
  const values = days.map((day) => {
    const value = Number(day.matched);
    return Number.isFinite(value) ? value : 0;
  });
  const max = Math.max(...values);
  const maxLabel = svgEl("text");
  attr(maxLabel, "class", "day-label");
  attr(maxLabel, "x", "0");
  attr(maxLabel, "y", "11");
  maxLabel.textContent = formatCount(max);
  svg.append(maxLabel);
  days.forEach((day, i) => {
    const safe = values[i];
    const h = max > 0 ? (safe / max) * barArea : 0;
    const rect = svgEl("rect");
    attr(rect, "class", "day-bar");
    attr(rect, "x", String(i * (barW + gap)));
    attr(rect, "y", String(barBase - h));
    attr(rect, "width", String(barW));
    attr(rect, "height", String(h));
    const tip = svgEl("title");
    tip.textContent = `${day.block_date} ${formatCount(safe)}`;
    rect.append(tip);
    svg.append(rect);
  });
  const axis = svgEl("line");
  attr(axis, "class", "day-axis");
  attr(axis, "x1", "0");
  attr(axis, "y1", String(barBase));
  attr(axis, "x2", String(width));
  attr(axis, "y2", String(barBase));
  svg.append(axis);
  const first = svgEl("text");
  attr(first, "class", "day-label");
  attr(first, "x", "0");
  attr(first, "y", "140");
  first.textContent = days[0].block_date;
  const last = svgEl("text");
  attr(last, "class", "day-label");
  attr(last, "x", String(width));
  attr(last, "y", "140");
  attr(last, "text-anchor", "end");
  last.textContent = days[days.length - 1].block_date;
  svg.append(first, last);
  box.append(svg);
  const sentence = dailyDiffSentence(thesis);
  el(box, "p", sentence ? "meta" : "missing", sentence ?? "missing");
}

function numberDailyChart() {
  if (!dailyCaption) return;
  figureNo += 1;
  dailyCaption.textContent = `Figure ${figureNo}. Daily matched receipts.`;
}

function renderPreregFailure(root) {
  const note = el(root, "p", "meta");
  note.textContent = "An explorer shows Failure because social has no contract, so __fastdata_kv fails, and FastNEAR's indexer stores the arguments without checking success; the arguments stay in the transaction (";
  const link = el(note, "a", null, "PREREG-VERIFY.md");
  link.href = PREREG_VERIFY_URL;
  link.rel = "noreferrer";
  el(note, "span", null, ").");
}

function renderPost(root, thesis) {
  const post = el(root, "article", "post");
  const brand = el(post, "p", "brand");
  el(brand, "span", "brand-mark");
  brand.append("vet402");
  const title = el(post, "h1");
  title.textContent = "x402 on NEAR, counted before the verdict.";
  const exactRec = thesis?.numbers?.["near.known.named_delegate"];
  const exactText = formatValue(exactRec);
  const heroNum = el(post, "p", exactText == null ? "hero-num missing" : "hero-num");
  if (exactText == null) heroNum.textContent = "missing";
  else paintCount(heroNum, exactRec.value);
  renderHeroNote(post, thesis);
  el(post, "hr", "rule");
  el(post, "p", "brand-foot", "vet402");
}

function renderActions(root) {
  const row = el(root, "div", "actions");
  const primary = el(row, "a", "text-btn", "Read the line");
  primary.href = "#threshold-meter";
  const replay = el(row, "button", "text-btn", replayLabel(PREREG_RECORD.at));
  replay.type = "button";
  if (typeof replay.setAttribute === "function") replay.setAttribute("aria-pressed", "false");
  bindReplay(replay);
}

let replayTimer = null;

function setOn(node, on) {
  if (node.classList && typeof node.classList.toggle === "function") {
    node.classList.toggle("is-on", on);
    return;
  }
  const parts = new Set(String(node.className || "").split(/\s+/).filter(Boolean));
  if (on) parts.add("is-on");
  else parts.delete("is-on");
  node.className = [...parts].join(" ");
}

function bindReplay(button) {
  if (typeof button.addEventListener !== "function") return;
  button.addEventListener("click", () => {
    if (replayTimer != null && typeof clearTimeout === "function") clearTimeout(replayTimer);
    replayTimer = null;
    const steps = typeof document.querySelectorAll === "function" ? [...document.querySelectorAll(".replay-step")] : [];
    for (const step of steps) setOn(step, false);
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof button.setAttribute === "function") button.setAttribute("aria-pressed", "true");
    const panel = typeof document.getElementById === "function" ? document.getElementById("replay") : null;
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
    if (reduced || typeof setTimeout !== "function") {
      for (const step of steps) setOn(step, true);
      return;
    }
    let index = 0;
    const tick = () => {
      if (index >= steps.length) return;
      setOn(steps[index], true);
      index += 1;
      if (index < steps.length) replayTimer = setTimeout(tick, 700);
    };
    tick();
  });
}

function bandCell(parent, label, sub) {
  const cell = el(parent, "div", "band-cell");
  el(cell, "p", "meta", label);
  const num = el(cell, "p", "band-num", "");
  if (sub) el(cell, "p", "meta", sub);
  return num;
}

function renderBand(root, thesis, live, bq, querySql) {
  const reading = meterFromLive(live, thesis);
  const section = el(root, "section", "band");
  const head = el(section, "div", "band-head");
  const kind = showsDailyReading(reading, thesis) ? "Daily reading" : "Frozen snapshot";
  el(head, "p", "band-chip", `${kind} · read in-block`);
  const block = el(head, "p", "band-block");
  block.append("Block ");
  const blockNum = document.createElement("span");
  blockNum.className = "band-num";
  paintCount(blockNum, PREREG_RECORD.block);
  block.append(blockNum);

  const grid = el(section, "div", "band-grid");
  const tx = bandCell(grid, "Posted transaction", formatUtc(PREREG_RECORD.at));
  tx.textContent = shortId(PREREG_RECORD.tx);
  // A daily figure names its own window only when that run fetched the relays; otherwise it is the frozen census lower bound.
  const liveDay = reading.source === "live" && reading.relays_obtained === true;
  const lowerSub = liveDay
    ? "that day's window"
    : reading.lower_kind === "known_relays"
      ? "known relays"
      : reading.lower_kind === "sample_hits"
        ? "sample hits"
        : "daily reading";
  const lowerLabel = liveDay
    ? "Lower bound for that day's window"
    : reading.lower_kind === "known_relays"
      ? "Lower bound on N"
      : "Lower";
  paintCount(bandCell(grid, lowerLabel, lowerSub), reading.lower);
  const upperValue = Number(thesis?.numbers?.["near.bq.n_upper_bound"]?.value);
  if (Number.isFinite(upperValue)) {
    const upperCell = el(grid, "div", "band-cell");
    el(upperCell, "p", "meta", "Upper bound on N");
    const upperNum = el(upperCell, "p", "band-num", "");
    const upperShare = shareOfLine(upperValue, reading.line);
    el(upperCell, "p", "meta", upperShare ? `${upperShare} of the line` : "whole dates");
    paintCount(upperNum, upperValue);
    el(upperCell, "p", "meta", "The inner ft_transfer receipt is not required to succeed, so this count is at least N.");
  }
  paintCount(bandCell(grid, "Line", "posted before the count"), reading.line);
  renderQueryLine(section, bq);
  if (Number.isFinite(upperValue) && typeof querySql === "string" && querySql.trim() !== "") {
    const details = el(section, "details", "query-behind");
    el(details, "summary", null, "Query behind this number");
    el(details, "pre", "query-sql", querySql);
  }

  const accounts = el(section, "div", "band-accounts");
  const roster = thesis?.near?.known?.roster;
  if (!Array.isArray(roster) || roster.length === 0) {
    el(accounts, "p", "missing", "missing");
  } else {
    for (const row of roster) {
      const cell = el(accounts, "div", "band-cell");
      el(cell, "p", "meta account", shortId(row.account));
      el(cell, "p", "meta", "exact x402 settlements (30 days)");
      const num = el(cell, "p", "band-num");
      if (row.kind === "sample_signer") num.textContent = "not x402";
      else paintCount(num, row.delegate_usdc);
      el(cell, "p", "meta", `delegate USDC ${formatCount(row.delegate_usdc)}`);
    }
  }
  const range = formatRange(thesis?.numbers?.["near.known.named_delegate"]?.range);
  if (range) el(section, "p", "meta", range);
  if (Number.isFinite(upperValue)) {
    el(
      section,
      "p",
      "meta",
      `The daily file keeps the frozen bounds until a new full count arrives. The number that decides the claim is ${formatCount(upperValue)}.`,
    );
  }
}

function renderReplay(root, fileDigest) {
  if (replayTimer != null && typeof clearTimeout === "function") {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
  const section = el(root, "section", "replay");
  section.id = "replay";
  const lines = replaySteps(PREREG_RECORD, fileDigest);
  el(section, "p", "note", lines[0]);
  const list = el(section, "ol", "replay-steps");
  if (typeof list.setAttribute === "function") list.setAttribute("aria-live", "polite");
  for (const line of lines.slice(1)) el(list, "li", "replay-step", line);
}

export function sourceIndex(doc) {
  const out = {};
  const accounts = doc?.accounts;
  if (!Array.isArray(accounts)) return out;
  for (const row of accounts) {
    if (!row || typeof row.account !== "string" || !Array.isArray(row.sources)) continue;
    out[row.account] = row.sources.map((item) => String(item));
  }
  return out;
}

function renderSources(card, row, sources) {
  const list = sources?.[row.account];
  if (!Array.isArray(list) || list.length === 0) {
    el(card, "p", "meta", "Source missing");
    return;
  }
  for (const item of list) {
    const p = el(card, "p", "meta");
    const url = item.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.;]+$/, "");
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noreferrer";
      link.textContent = item;
      p.append("Source ", link);
    } else {
      p.textContent = `Source ${item}`;
    }
  }
}

function otherActivity(row) {
  if (row?.account === "uvd-facilitator.near") {
    return `${formatCount(row.signer_txs)} (${formatCount(row.ft_transfer_call)} ft_transfer_call, ${formatCount(row.escrow_calls)} escrow calls). Not classified.`;
  }
  if (row?.kind === "sample_signer") {
    return `${formatCount(row.delegate_usdc)} delegate USDC transfers, not known to be x402`;
  }
  return formatCount(row?.signer_txs ?? 0);
}

function renderFacilitators(root, thesis, sources) {
  el(root, "h2", null, "Evidence");
  const accounts = formatValue(thesis?.numbers?.["near.known.accounts"]);
  el(
    root,
    "p",
    "note",
    accounts
      ? `${accounts} accounts are on the roster. A facilitator sees only its own account. These cards line them up together.`
      : "The roster count is missing.",
  );
  const roster = thesis?.near?.known?.roster;
  if (!Array.isArray(roster) || roster.length === 0) {
    el(root, "p", "missing", "missing");
    cite(root, "near.known.lower");
    return;
  }
  const grid = el(root, "div", "evidence");
  grid.id = "evidence";
  for (const row of roster) {
    const box = el(grid, "article", "card exhibit");
    el(box, "h3", "account", row.account ?? "");
    renderSources(box, row, sources);
    el(box, "p", "meta", "exact x402 settlements (30 days)");
    el(box, "p", "value", row.kind === "sample_signer" ? "not x402" : formatCount(row.delegate_usdc));
    el(box, "p", "meta", "other activity");
    el(box, "p", "activity", otherActivity(row));
    if (row.note) el(box, "p", "meta", row.note);
    if (row.account === "x402-relayer2.mike.near") {
      const settled = settledExactLine(thesis?.near?.relayer?.payments, thesis?.near?.known?.window?.from);
      if (settled) el(box, "p", "meta", settled);
    }
  }
  cite(root, "near.known.lower");
}

function claimPercents(reading) {
  const values = [reading?.line, reading?.lower].filter((number) => Number.isFinite(number) && number >= 0);
  const max = Math.max(1, ...values);
  const at = (number) => (Number.isFinite(number) && number >= 0 ? (number / max) * 100 : null);
  return { line: at(reading?.line), lower: at(reading?.lower) };
}

function shareOfLine(lower, line) {
  if (!Number.isFinite(lower) || !Number.isFinite(line) || line <= 0) return null;
  return `${((lower / line) * 100).toFixed(1)}%`;
}

function recordStamp(thesis, id) {
  const rec = thesis?.numbers?.[id];
  return rec?.as_of ? formatUtc(rec.as_of) : "missing";
}

function meterTimes(reading, thesis) {
  if (showsDailyReading(reading, thesis)) {
    const at = reading.updated ? formatUtc(reading.updated) : "missing";
    const lineAt = recordStamp(thesis, "threshold.line");
    return `Lower bound retrieved ${at}. Line retrieved ${lineAt}. Daily reading.`;
  }
  const lowerId =
    reading.lower_kind === "census"
      ? "near.relays.lower"
      : reading.lower_kind === "sample_hits"
        ? "near.delegate.sample_hits"
        : "near.known.lower";
  const lowerRec = thesis?.numbers?.[lowerId];
  const lowerAt = lowerRec?.as_of ? formatUtc(lowerRec.as_of) : "missing";
  const windowTo = lowerRec?.range?.to ? formatUtc(lowerRec.range.to) : "";
  const window = windowTo ? ` Window ends ${windowTo}.` : "";
  const lineAt = recordStamp(thesis, "threshold.line");
  return `Lower bound retrieved ${lowerAt}.${window} Line retrieved ${lineAt}. Frozen snapshot.`;
}

function renderMeter(root, thesis, live) {
  const reading = meterFromLive(live, thesis);
  const section = el(root, "section", "meter");
  section.id = "threshold-meter";
  figureNo += 1;
  el(section, "p", "caption", `Figure ${figureNo}. Lower bound on N and the posted line.`);
  el(section, "h2", null, "Threshold");
  el(section, "p", "meta", meterTimes(reading, thesis));
  const pair = el(section, "div", "meter-pair");
  const lowerBig = el(pair, "p", "meter-readout");
  lowerBig.textContent = Number.isFinite(reading.lower) ? formatCount(reading.lower) : "missing";
  el(pair, "p", "meta", reading.lower_kind === "known_relays" ? "lower bound on N" : "Lower");
  const lineBig = el(pair, "p", "meter-readout meter-line-num");
  lineBig.textContent = Number.isFinite(reading.line) ? formatCount(reading.line) : "missing";
  el(pair, "p", "meta", "line");
  const pos = claimPercents(reading);
  const track = el(section, "div", "meter-track");
  if (pos.lower != null) {
    const fill = el(track, "span", "meter-fill");
    fill.style.width = `${pos.lower}%`;
  }
  const place = (className, percent) => {
    if (percent == null) return;
    const mark = el(track, "span", className);
    mark.style.left = `${percent}%`;
  };
  place("meter-line", pos.line);
  place("meter-mark lower", pos.lower);
  const textOf = (name, value) => `${name} ${value == null ? "missing" : formatCount(value)}`;
  const lowerName =
    reading.lower_kind === "sample_hits"
      ? "Lower, sample hits"
      : reading.lower_kind === "known_relays"
        ? "Lower, known relays"
        : "Lower";
  const lowerText =
    reading.lower_kind === "known_relays"
      ? `${textOf("Lower, known relays", reading.lower)} = lower bound on N`
      : textOf(lowerName, reading.lower);
  el(section, "p", "meta", `${lowerText}. ${textOf("Line", reading.line)}.`);
  const frozenLower = Number(thesis?.numbers?.["near.known.lower"]?.value);
  const frozenLine = Number(thesis?.numbers?.["threshold.line"]?.value);
  const upperValue = Number(thesis?.numbers?.["near.bq.n_upper_bound"]?.value);
  const lineForVerdict = Number.isFinite(frozenLine) ? frozenLine : reading.line;
  const share = shareOfLine(reading.lower, reading.line);
  const frozenShare = shareOfLine(frozenLower, lineForVerdict);
  const upperShare = shareOfLine(upperValue, lineForVerdict);
  const decided = Number.isFinite(upperValue) && Number.isFinite(frozenLower) && Number.isFinite(lineForVerdict)
    && upperValue < lineForVerdict && upperShare && frozenShare;
  if (decided) {
    el(
      section,
      "p",
      "meta",
      `${formatCount(frozenLower)} is ${frozenShare} of the line. That figure is the known-relay lower bound. The upper bound on N is ${formatCount(upperValue)}, ${upperShare} of the line. N ≤ ${formatCount(upperValue)} < ${formatCount(lineForVerdict)}, all 30 days counted: the threshold is not crossed. The claim stands.`,
    );
  } else if (share != null && reading.lower < reading.line) {
    el(
      section,
      "p",
      "meta",
      `${formatCount(reading.lower)} is ${share} of the line. This daily figure is a lower bound for its own window.`,
    );
  }
  if (reading.source === "live" && Number.isFinite(reading.lower)) {
    if (reading.relays_obtained === true) el(section, "p", "meta", `${formatCount(reading.lower)} is the lower bound for that day's window.`);
  }
  cite(section, "near.known.lower");
  cite(section, "threshold.line");
  const note = el(section, "p", "meta");
  const anchor = el(note, "a", null, "Pre-registered threshold");
  anchor.href = PREREGISTERED_POST;
  anchor.rel = "noreferrer";
}

function renderSampleAppendix(root, thesis) {
  el(root, "h2", null, "Appendix");
  el(root, "p", "note", "Biased sample estimate. Reference only. Not used in the claim.");
  const numbers = thesis?.numbers ?? {};
  const box = el(root, "div");
  figure(box, "Sample estimate", formatValue(numbers["near.delegate.estimate"]), numbers["near.delegate.estimate"], "near.delegate.estimate");
  figure(box, "Biased sample estimate, 95%", formatValue(numbers["near.delegate.estimate_upper_95"]), numbers["near.delegate.estimate_upper_95"], "near.delegate.estimate_upper_95");
}

export function renderDashboard(root, thesis, live = null, context = null) {
  const numbers = thesis?.numbers ?? {};
  const watched = [];
  const take = (id) => {
    const rec = numbers[id] ?? null;
    watched.push(rec);
    return rec;
  };
  const attempts = take("vet402.attempts");
  const settled = take("vet402.settled");
  const delivered = take("vet402.delivered");
  const x402 = take("x402.total.amount_30d");
  const baseShare = take("x402.base.share_amount_30d");
  const intents = take("intents.volume_30d");
  const vaultUsd = take("vault.usdc_out_30d.usd");
  const vaultCount = take("vault.usdc_out_30d.count");
  const ratioText = thesis?.model?.x402_over_intents_30d_display;
  if (typeof ratioText !== "string" || ratioText.trim() === "") watched.push(null);

  figureNo = 0;
  dailyCaption = null;
  root.replaceChildren();
  renderPost(root, thesis);
  renderActions(root);
  renderBand(root, thesis, live, context?.bq ?? null, context?.querySql ?? "");
  renderPreregFailure(root);
  renderReplay(root, context?.preregDigest ?? null);
  renderFacilitators(root, thesis, context?.sources ?? null);
  renderMeter(root, thesis, live);
  renderDailyChart(root, thesis, context?.bq ?? null);
  numberDailyChart();
  const evidenceUnread = context != null && (context.preregDigest == null || context.sources == null);
  if (evidenceUnread) {
    el(root, "p", "missing", "Evidence files were not loaded. The missing-number count is withheld.");
  } else {
    const incomplete = countMissing(watched);
    el(root, "p", incomplete > 0 ? "count missing" : "count", `Incomplete numbers: ${incomplete}`);
  }

  const cards = el(root, "div");
  cards.id = "cards";
  figure(card(cards), "vet402 attempts", formatValue(attempts), attempts, "vet402.attempts");
  figure(card(cards), "vet402 settled", formatValue(settled), settled, "vet402.settled");
  let deliveredText = null;
  if (formatValue(delivered) != null) {
    const share = settled && Number(settled.value) > 0 ? formatShare(Number(delivered.value) / Number(settled.value)) : "missing";
    deliveredText = `${formatValue(delivered)} (${share} of settled)`;
  }
  figure(card(cards), "vet402 delivered", deliveredText, delivered, "vet402.delivered");
  const x402Card = card(cards);
  figure(x402Card, "x402, 30 days", formatValue(x402), x402, "x402.total.amount_30d");
  figure(x402Card, "Base share of dollars", formatValue(baseShare), baseShare, "x402.base.share_amount_30d");
  figure(
    card(cards),
    "NEAR Intents, 30 days",
    formatValue(intents),
    intents,
    "intents.volume_30d",
    defillamaWindowLine(intents),
  );
  const vaultCard = card(cards);
  figure(vaultCard, "Treasury USDC out, 30 days", formatValue(vaultUsd), vaultUsd, "vault.usdc_out_30d.usd");
  const countText = formatValue(vaultCount);
  figure(vaultCard, "Treasury transfers, 30 days", countText == null ? null : `${countText} transfers`, vaultCount, "vault.usdc_out_30d.count");
  const ratioCard = card(cards);
  el(ratioCard, "h3", null, "x402 / Intents, 30 days");
  const ratioOk = typeof ratioText === "string" && ratioText.trim() !== "";
  el(ratioCard, "p", ratioOk ? "value" : "value missing", ratioOk ? ratioText : "missing");
  const provenance = [
    ["x402", x402],
    ["Intents", intents],
  ];
  for (const [name, rec] of provenance) {
    const rangeText = formatRange(rec?.range);
    metaLine(ratioCard, `${name} range`, rangeText, rangeText === "");
    const dateText = rec?.as_of != null && String(rec.as_of).trim() !== "" ? formatUtc(rec.as_of) : "";
    metaLine(ratioCard, `${name} retrieved`, dateText, dateText === "");
    const sourceText = rec?.source != null && String(rec.source).trim() !== "" ? String(rec.source) : "";
    metaLine(ratioCard, `${name} source`, sourceText, sourceText === "");
  }
  cite(ratioCard, "ratio");

  el(root, "h2", null, "Breakdown");
  cite(root, "breakdown");
  if (!Array.isArray(thesis?.breakdown)) el(root, "p", "missing", "missing");
  else {
    root.append(table(
      ["Group", "status", "held_reason", "tx", "2xx", "Count"],
      sortedBreakdown(thesis.breakdown).map((row) => [
        row.category,
        row.status,
        row.held_reason ?? "",
        row.has_tx ? "true" : "false",
        row.http_2xx ? "true" : "false",
        formatCount(row.count),
      ]),
    ));
  }

  el(root, "h2", null, "Sensitivity");
  const fee = Number(thesis?.model?.fee_rate);
  el(
    root,
    "p",
    Number.isFinite(fee) ? "note" : "missing",
    Number.isFinite(fee) ? `Fee rate ${(fee * 100).toFixed(3)}%.` : "missing",
  );
  el(root, "p", "note", "Rows are multiples of x402 volume. Columns are the share that passes through NEAR Intents. Values are yearly USD.");
  cite(root, "sensitivity");
  const sense = sensitivityRows(thesis?.model);
  if (!sense) el(root, "p", "missing", "missing");
  else root.append(table(["Multiple", "1%", "10%", "50%"], sense));

  renderSampleAppendix(root, thesis);

  el(root, "h2", null, "Quotes");
  if (!Array.isArray(thesis?.quotes)) el(root, "p", "missing", "missing");
  else {
    root.append(table(
      ["id", "sentence", "url", "context"],
      thesis.quotes.map((quote) => {
        const link = document.createElement("a");
        link.href = quote.url ?? "";
        link.rel = "noreferrer";
        link.textContent = quote.url ?? "";
        return [quote.id ?? "", quote.full_sentence ?? "", link, quote.context ?? ""];
      }),
    ));
  }

  el(root, "h2", null, "Terms");
  const definitions = thesis?.definitions;
  if (definitions == null || typeof definitions !== "object" || Array.isArray(definitions)) {
    el(root, "p", "missing", "missing");
  } else {
    root.append(table(["Term", "Definition"], Object.entries(definitions)));
  }
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) return null;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadPreregDigest() {
  try {
    const res = await fetch(new URL("./PREREG.md", import.meta.url));
    if (!res.ok) return null;
    return sha256Hex(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

async function loadSources() {
  try {
    const res = await fetch(new URL("./facilitators.json", import.meta.url));
    if (!res.ok) return null;
    return sourceIndex(await res.json());
  } catch {
    return null;
  }
}

async function loadBigQuery() {
  try {
    const res = await fetch(new URL("./bigquery-n-upper-bound.json", import.meta.url));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadUpperQuery() {
  try {
    const res = await fetch(new URL("./sql/n-upper-bound.sql", import.meta.url));
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function boot() {
  const root = document.querySelector("#app");
  if (!root) return;
  try {
    const res = await fetch("./thesis.json");
    if (!res.ok) throw new Error(String(res.status));
    const thesis = await res.json();
    let live = null;
    try {
      const liveRes = await fetch("./live.json");
      if (liveRes.ok) live = await liveRes.json();
    } catch {
      live = null;
    }
    const [preregDigest, sources, bq, querySql] = await Promise.all([
      loadPreregDigest(),
      loadSources(),
      loadBigQuery(),
      loadUpperQuery(),
    ]);
    renderDashboard(root, thesis, live, { preregDigest, sources, bq, querySql });
  } catch {
    const fail = document.createElement("p");
    fail.className = "missing";
    fail.textContent = "Could not load thesis.json.";
    root.append(fail);
  }
}

if (typeof document !== "undefined") boot();
