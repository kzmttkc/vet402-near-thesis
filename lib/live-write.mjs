import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { liveRecord } from "../docs/live.mjs";

// Append one UTC day under data/live and point the dashboard at that same reading.
// Older days are left in place. The same day is replaced.
export async function appendLiveReading({ thesis, root, relaysObtained = false, now = new Date() } = {}) {
  const record = liveRecord(thesis, { relaysObtained, now });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    throw new Error("live reading needs a YYYY-MM-DD date");
  }
  const body = `${JSON.stringify(record, null, 2)}\n`;
  const liveDir = join(root, "data", "live");
  await mkdir(liveDir, { recursive: true });
  const dated = join(liveDir, `${record.date}.json`);
  await writeFile(dated, body);
  const dashboard = join(root, "docs", "live.json");
  await mkdir(dirname(dashboard), { recursive: true });
  await writeFile(dashboard, body);
  return { record, dated, dashboard };
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invoked || import.meta.url === pathToFileURL(invoked).href) {
  const thesisPath = process.env.THESIS;
  const root = process.env.GITHUB_WORKSPACE;
  if (!thesisPath || !root) {
    console.error("THESIS and GITHUB_WORKSPACE are required");
    process.exit(1);
  }
  const thesis = JSON.parse(await readFile(thesisPath, "utf8"));
  const saved = await appendLiveReading({
    thesis,
    root,
    relaysObtained: process.env.RELAYS === "1",
  });
  console.log(saved.dated);
}
