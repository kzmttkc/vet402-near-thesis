import { PREREGISTERED_POST, meterFromLive, meterPositions } from "./live.mjs";

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

function figure(parent, label, valueText, rec) {
  const box = el(parent, "div", "figure");
  el(box, "h3", null, label);
  const missingValue = valueText == null;
  el(box, "p", missingValue ? "value missing" : "value", missingValue ? "missing" : valueText);
  const rangeText = formatRange(rec?.range);
  metaLine(box, "Range", rangeText, rangeText === "");
  const dateText = rec?.as_of != null && String(rec.as_of).trim() !== "" ? formatUtc(rec.as_of) : "";
  metaLine(box, "Retrieved", dateText, dateText === "");
  const sourceText = rec?.source != null && String(rec.source).trim() !== "" ? String(rec.source) : "";
  metaLine(box, "Source", sourceText, sourceText === "");
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

function renderMeter(root, thesis, live) {
  const reading = meterFromLive(live, thesis);
  const section = el(root, "section", "meter");
  section.id = "threshold-meter";
  el(section, "h2", null, "Threshold");
  const kind = reading.source === "live" ? "Daily reading" : "Frozen snapshot";
  const updated = reading.updated ? formatUtc(reading.updated) : "";
  el(
    section,
    "p",
    "meta",
    updated ? `Last updated ${updated}. ${kind}.` : `Last updated missing. ${kind}.`,
  );
  const pos = meterPositions(reading);
  const track = el(section, "div", "meter-track");
  const place = (className, percent) => {
    if (percent == null) return;
    const mark = el(track, "span", className);
    mark.style.left = `${percent}%`;
  };
  place("meter-line", pos.line);
  place("meter-mark lower", pos.lower);
  place("meter-mark estimate", pos.estimate);
  place("meter-mark upper", pos.upper);
  const lowerName =
    reading.lower_kind === "sample_hits"
      ? "Lower, sample hits"
      : reading.lower_kind === "known_relays"
        ? "Lower, known relays"
        : "Lower";
  const textOf = (name, value) => `${name} ${value == null ? "missing" : formatCount(value)}`;
  el(
    section,
    "p",
    "meta",
    `${textOf(lowerName, reading.lower)}. ${textOf("Estimate", reading.estimate)}. ${textOf("Upper", reading.upper)}. ${textOf("Line", reading.line)}.`,
  );
  const note = el(section, "p", "meta");
  const anchor = el(note, "a", null, "Pre-registered threshold");
  anchor.href = PREREGISTERED_POST;
  anchor.rel = "noreferrer";
}

export function renderDashboard(root, thesis, live = null) {
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

  const h1 = root.querySelector("h1");
  root.replaceChildren();
  if (h1) root.append(h1);
  else el(root, "h1", null, "Where does NEAR fit in agent payments? Numbers from one re-runnable script.");
  renderMeter(root, thesis, live);
  const incomplete = countMissing(watched);
  el(root, "p", incomplete > 0 ? "count missing" : "count", `Incomplete numbers: ${incomplete}`);

  const cards = el(root, "div");
  cards.id = "cards";
  figure(card(cards), "vet402 attempts", formatValue(attempts), attempts);
  figure(card(cards), "vet402 settled", formatValue(settled), settled);
  let deliveredText = null;
  if (formatValue(delivered) != null) {
    const share = settled && Number(settled.value) > 0 ? formatShare(Number(delivered.value) / Number(settled.value)) : "missing";
    deliveredText = `${formatValue(delivered)} (${share} of settled)`;
  }
  figure(card(cards), "vet402 delivered", deliveredText, delivered);
  const x402Card = card(cards);
  figure(x402Card, "x402, 30 days", formatValue(x402), x402);
  figure(x402Card, "Base share of dollars", formatValue(baseShare), baseShare);
  figure(card(cards), "NEAR Intents, 30 days", formatValue(intents), intents);
  const vaultCard = card(cards);
  figure(vaultCard, "Treasury USDC out, 30 days", formatValue(vaultUsd), vaultUsd);
  const countText = formatValue(vaultCount);
  figure(vaultCard, "Treasury transfers, 30 days", countText == null ? null : `${countText} transfers`, vaultCount);
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

  el(root, "h2", null, "Breakdown");
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
  const sense = sensitivityRows(thesis?.model);
  if (!sense) el(root, "p", "missing", "missing");
  else root.append(table(["Multiple", "1%", "10%", "50%"], sense));

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
    renderDashboard(root, thesis, live);
  } catch {
    const fail = document.createElement("p");
    fail.className = "missing";
    fail.textContent = "Could not load thesis.json.";
    root.append(fail);
  }
}

if (typeof document !== "undefined") boot();
