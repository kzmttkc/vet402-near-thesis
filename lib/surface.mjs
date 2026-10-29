import { readFileSync } from "node:fs";

const TOKEN = /\$\d+(?:\.\d+)?[MB]\b|\d+\.\d+%|\d{1,3}(?:,\d{3})+|\b\d+\b/g;

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function formatUsd(value) {
  const number = Number(value);
  const sign = number < 0 ? "-" : "";
  const abs = Math.abs(number);
  if (abs >= 1e9) return `${sign}$${trimFixed(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}$${trimFixed(abs / 1e6, 2)}M`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUsdInteger(value) {
  const number = Math.round(Number(value));
  const sign = number < 0 ? "-" : "";
  return `${sign}$${Math.abs(number).toLocaleString("en-US")}`;
}

function acceptedForms(rec) {
  const forms = new Set([formatForSurface(rec)]);
  const unit = String(rec?.unit ?? "");
  if (/usd/i.test(unit) && !/share/i.test(unit)) {
    const plain = formatUsdInteger(rec?.value);
    forms.add(plain);
    if (plain.startsWith("$")) forms.add(plain.slice(1));
  }
  return forms;
}

export function formatForSurface(rec) {
  const unit = String(rec?.unit ?? "");
  const value = Number(rec?.value);
  if (/share/i.test(unit)) return `${(value * 100).toFixed(1)}%`;
  if (/usd/i.test(unit)) return formatUsd(value);
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return String(rec.value);
}

function nearestToken(window) {
  const tokens = [...window.matchAll(TOKEN)].map((match) => match[0]);
  return tokens.length ? tokens[tokens.length - 1] : null;
}

export function checkSurfaces(files, numbers) {
  const mismatches = [];
  const notes = ["spelled-out numbers are not checked"];
  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    for (const [id, rec] of Object.entries(numbers)) {
      const want = formatForSurface(rec);
      const forms = acceptedForms(rec);
      let from = 0;
      while (from < text.length) {
        const at = text.indexOf(id, from);
        if (at < 0) break;
        const window = text.slice(Math.max(0, at - 180), at);
        const got = nearestToken(window);
        if (got != null && !forms.has(got)) {
          mismatches.push({ file, id, got, want });
        }
        from = at + id.length;
      }
    }
  }
  return { mismatches, count: mismatches.length, notes };
}
