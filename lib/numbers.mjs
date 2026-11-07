const UNIT_KINDS = new Set(["count", "usd", "usdc", "share"]);

// Kind is decided from the whole unit, not from a substring. "USDC" inside
// "USDC transfer events" is a count. Only an exact "USD" or "USDC" is money.
export function unitKindFromUnit(unit) {
  const text = String(unit ?? "");
  if (/share/i.test(text)) return "share";
  if (text === "USD") return "usd";
  if (text === "USDC") return "usdc";
  return "count";
}

export function record(id, fields) {
  const { value, unit, unit_kind, range, as_of, source, definition } = fields ?? {};
  const missing = [];
  if (range === undefined || range === null) missing.push("range");
  if (as_of === undefined || as_of === null || as_of === "") missing.push("as_of");
  if (source === undefined || source === null || source === "") missing.push("source");
  if (missing.length > 0) {
    throw new Error(`number ${id} missing ${missing.join(", ")}`);
  }
  const kind = unit_kind ?? unitKindFromUnit(unit);
  if (!UNIT_KINDS.has(kind)) {
    throw new Error(`number ${id} bad unit_kind ${kind}`);
  }
  return { value, unit, unit_kind: kind, range, as_of, source, definition };
}
