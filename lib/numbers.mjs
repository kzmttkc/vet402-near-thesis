export function record(id, fields) {
  const { value, unit, range, as_of, source, definition } = fields ?? {};
  const missing = [];
  if (range === undefined || range === null) missing.push("range");
  if (as_of === undefined || as_of === null || as_of === "") missing.push("as_of");
  if (source === undefined || source === null || source === "") missing.push("source");
  if (missing.length > 0) {
    throw new Error(`number ${id} missing ${missing.join(", ")}`);
  }
  return { value, unit, range, as_of, source, definition };
}
