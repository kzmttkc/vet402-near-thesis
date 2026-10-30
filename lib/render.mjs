import { formatUsd, formatUsdInteger } from "./surface.mjs";

function unknown(inner) {
  const err = new Error(`unknown placeholder: {{${inner}}}`);
  err.code = "UNKNOWN";
  throw err;
}

function missing(message) {
  const err = new Error(message);
  err.code = "MISSING";
  throw err;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatUtcMinute(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) missing(`bad datetime: ${value}`);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatRange(range) {
  if (range == null || typeof range !== "object") missing("missing range");
  const hasFrom = range.from != null && range.from !== "";
  const hasTo = range.to != null && range.to !== "";
  const hasBlocks = range.from_block != null && range.to_block != null;
  if (hasFrom && hasTo) {
    return `from ${formatUtcMinute(range.from)} to ${formatUtcMinute(range.to)}`;
  }
  if (hasBlocks && !hasFrom && !hasTo) {
    return `blocks ${range.from_block} to ${range.to_block}`;
  }
  missing("range is not a from/to datetime or a block span");
}

export function formatNumber(rec, { compact = false } = {}) {
  const unit = String(rec?.unit ?? "");
  const value = Number(rec?.value);
  if (!Number.isFinite(value)) missing("number value is not finite");
  if (/share/i.test(unit)) return `${(value * 100).toFixed(1)}%`;
  if (/usd/i.test(unit)) return compact ? formatUsd(value) : formatUsdInteger(value);
  return Math.round(value).toLocaleString("en-US");
}

function cell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function needNumber(thesis, id) {
  const rec = thesis?.numbers?.[id];
  if (rec == null) missing(`missing id: ${id}`);
  return rec;
}

function modelTable(table) {
  if (!Array.isArray(table) || table.length === 0) missing("missing model.table");
  const multiples = [1, 10, 100, 1000];
  const passes = [0.01, 0.1, 0.5];
  const lines = ["| Multiple | 1% | 10% | 50% |", "| --- | --- | --- | --- |"];
  for (const multiple of multiples) {
    const cells = passes.map((pass) => {
      const row = table.find((item) => item.multiple === multiple && item.pass_through === pass);
      if (!row || !Number.isFinite(Number(row.annual_near_usd))) {
        missing(`missing model cell ${multiple}x ${pass}`);
      }
      return formatUsdInteger(row.annual_near_usd);
    });
    lines.push(`| ${multiple}x | ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

function breakdownTable(breakdown) {
  if (!Array.isArray(breakdown)) missing("missing breakdown");
  const rows = [...breakdown].sort((a, b) => {
    return (
      String(a.category).localeCompare(String(b.category)) ||
      String(a.status).localeCompare(String(b.status)) ||
      String(a.held_reason).localeCompare(String(b.held_reason)) ||
      Number(Boolean(a.has_tx)) - Number(Boolean(b.has_tx)) ||
      Number(Boolean(a.http_2xx)) - Number(Boolean(b.http_2xx))
    );
  });
  const lines = ["| Group | status | held_reason | tx | 2xx | Count |", "| --- | --- | --- | --- | --- | --- |"];
  for (const row of rows) {
    lines.push(
      `| ${cell(row.category)} | ${cell(row.status)} | ${cell(row.held_reason)} | ${row.has_tx ? "true" : "false"} | ${row.http_2xx ? "true" : "false"} | ${Math.round(Number(row.count)).toLocaleString("en-US")} |`,
    );
  }
  return lines.join("\n");
}

function definitionsTable(definitions) {
  if (definitions == null || typeof definitions !== "object" || Array.isArray(definitions)) {
    missing("missing definitions");
  }
  const lines = ["| Term | Definition |", "| --- | --- |"];
  for (const [term, definition] of Object.entries(definitions)) {
    if (typeof definition !== "string" || definition.trim() === "") missing(`missing definition: ${term}`);
    lines.push(`| ${cell(term)} | ${cell(definition)} |`);
  }
  return lines.join("\n");
}

function quotesTable(quotes) {
  if (!Array.isArray(quotes)) missing("missing quotes");
  const lines = ["| id | sentence | url | context |", "| --- | --- | --- | --- |"];
  for (const quote of quotes) {
    for (const field of ["id", "full_sentence", "url", "context"]) {
      if (typeof quote?.[field] !== "string" || quote[field].trim() === "") missing(`quote missing ${field}`);
    }
    lines.push(`| ${cell(quote.id)} | ${cell(quote.full_sentence)} | ${cell(quote.url)} | ${cell(quote.context)} |`);
  }
  return lines.join("\n");
}

function resolveToken(inner, thesis) {
  if (inner === "model.ratio") {
    const display = thesis?.model?.x402_over_intents_30d_display;
    if (typeof display !== "string" || display.trim() === "") missing("missing model.ratio");
    return display;
  }
  if (inner === "model.fee_rate") {
    const rate = Number(thesis?.model?.fee_rate);
    if (!Number.isFinite(rate)) missing("missing model.fee_rate");
    return `${(rate * 100).toFixed(3)}%`;
  }
  if (inner === "model.table") return modelTable(thesis?.model?.table);
  if (inner.startsWith("model.input.")) {
    // Figures taken from data/model-inputs.json, each traced to a quote by its "sources" map.
    const inputs = thesis?.model?.inputs ?? {};
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    const usdMillions = (v) => `$${Math.round(v / 1e6).toLocaleString("en-US")} million`;
    const usdBillions = (v) => `$${(v / 1e9).toFixed(1)} billion`;
    const forms = {
      "model.input.take_rate": () => pct(inputs.take_rate),
      "model.input.take_rate_trailing_30d": () => pct(inputs.take_rate_trailing_30d),
      "model.input.trailing_over_lifetime": () => (inputs.take_rate_trailing_30d / inputs.take_rate).toFixed(1),
      "model.input.buyback_usd": () => usdMillions(inputs.buyback_usd),
      "model.input.q3_intents_usd": () => usdBillions(inputs.q3_intents_usd),
      "model.q3_gap": () => pct(thesis?.model?.q3_gap),
    };
    const make = forms[inner];
    if (!make) missing(`unknown model input: ${inner}`);
    const out = make();
    if (/NaN|undefined/.test(out)) missing(`missing model input: ${inner}`);
    return out;
  }
  if (inner === "model.q3_gap") {
    const gap = Number(thesis?.model?.q3_gap);
    if (!Number.isFinite(gap)) missing("missing model.q3_gap");
    return `${(gap * 100).toFixed(1)}%`;
  }
  if (inner === "breakdown.table") return breakdownTable(thesis?.breakdown);
  if (inner === "definitions.table") return definitionsTable(thesis?.definitions);
  if (inner === "quotes.table") return quotesTable(thesis?.quotes);
  if (inner === "snapshot.sha256") {
    const sha = thesis?.snapshot?.export_sha256;
    if (typeof sha !== "string" || sha.trim() === "") missing("missing snapshot.sha256");
    return sha;
  }
  if (inner === "snapshot.derived_sha256") {
    const sha = thesis?.snapshot?.derived_sha256;
    if (typeof sha !== "string" || sha.trim() === "") missing("missing snapshot.derived_sha256");
    return sha;
  }
  if (inner === "snapshot.retrieved_at") {
    const at = thesis?.snapshot?.export_retrieved_at;
    if (typeof at !== "string" || at.trim() === "") missing("missing snapshot.retrieved_at");
    return at;
  }
  const keyed = /^(n|range|asof|source):([A-Za-z0-9_.]+)(\|M)?$/.exec(inner);
  if (!keyed) unknown(inner);
  const [, kind, id, compact] = keyed;
  if (compact && kind !== "n") unknown(inner);
  const rec = needNumber(thesis, id);
  if (kind === "n") return formatNumber(rec, { compact: Boolean(compact) });
  if (kind === "range") return formatRange(rec.range);
  if (kind === "asof") {
    if (rec.as_of == null || rec.as_of === "") missing(`missing as_of: ${id}`);
    return formatUtcMinute(rec.as_of);
  }
  if (typeof rec.source !== "string" || rec.source.trim() === "") missing(`missing source: ${id}`);
  return rec.source;
}

export function renderTemplate(text, thesis) {
  const re = /\{\{([^{}]*)\}\}/g;
  const problems = [];
  const rendered = text.replace(re, (full, inner) => {
    try {
      return resolveToken(inner, thesis);
    } catch (err) {
      if (err?.code === "UNKNOWN" || err?.code === "MISSING") {
        problems.push(err.message);
        return full;
      }
      throw err;
    }
  });
  const leftover = text.replace(re, "");
  if (leftover.includes("{{") || leftover.includes("}}")) problems.push("unknown placeholder");
  if (problems.length > 0) throw new Error([...new Set(problems)].join(". "));
  return rendered;
}
