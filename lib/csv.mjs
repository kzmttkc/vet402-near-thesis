function parseRecords(text) {
  const records = [];
  let record = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    if (record.length === 1 && record[0] === "") {
      record = [];
      return;
    }
    records.push(record);
    record = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      endField();
      i += 1;
      continue;
    }
    if (c === "\n") {
      endField();
      endRecord();
      i += 1;
      continue;
    }
    if (c === "\r") {
      endField();
      endRecord();
      i += 1;
      if (i < n && text[i] === "\n") i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (inQuotes) {
    throw new Error("unterminated quoted CSV field");
  }
  if (field.length > 0 || record.length > 0) {
    endField();
    endRecord();
  }
  return records;
}

export function parseCsv(text) {
  const records = parseRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0];
  const rows = records.slice(1).map((fields) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = fields[i] ?? "";
    }
    return obj;
  });
  return { headers, rows };
}

export function escapeCsvField(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function stringifyCsv(headers, rows) {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}
