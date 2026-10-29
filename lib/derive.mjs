import { createHash } from "node:crypto";

export const DROPPED_COLUMNS = ["request_body", "request_query", "l2_reading"];

export function hashResourceKey(resource_key) {
  return createHash("sha256").update(resource_key ?? "", "utf8").digest("hex");
}

export function deriveHeaders(headers) {
  return headers.filter((h) => !DROPPED_COLUMNS.includes(h));
}

export function deriveRow(row, headers) {
  const out = {};
  for (const h of headers) {
    if (h === "resource_key") out[h] = hashResourceKey(row.resource_key);
    else out[h] = row[h] ?? "";
  }
  return out;
}

export function deriveRows(headers, rows) {
  const nextHeaders = deriveHeaders(headers);
  return {
    headers: nextHeaders,
    rows: rows.map((row) => deriveRow(row, nextHeaders)),
  };
}
