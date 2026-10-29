import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getText } from "../http.mjs";
import { record } from "../numbers.mjs";

export const DEFILLAMA_URL = "https://api.llama.fi/summary/dexs/near-intents";

function isoFromUnix(ts) {
  const seconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return new Date(seconds * 1000).toISOString();
}

// If total24h is null or the last day repeats the day before, that day is unfinished and is dropped.
// The 30-day sum is taken again over the last 30 remaining days. All-time stays the published totalAllTime.
export function intentsFromBody(body, as_of) {
  const parsed = typeof body === "string" ? JSON.parse(body) : body;
  const chart = parsed?.totalDataChart;
  if (!Array.isArray(chart) || chart.length < 2) {
    throw new Error("defillama totalDataChart missing");
  }
  const points = chart.map((row) => [Number(row[0]), Number(row[1])]);
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const drop = parsed.total24h == null || last[1] === prev[1];
  const used = drop ? points.slice(0, -1) : points;
  const window = used.slice(-30);
  if (window.length < 30) {
    throw new Error(`defillama needs 30 daily points, have ${window.length}`);
  }
  const volume_30d = window.reduce((sum, row) => sum + row[1], 0);
  const volume_all_time = Number(parsed.totalAllTime);
  if (!Number.isFinite(volume_all_time)) {
    throw new Error("defillama totalAllTime missing");
  }
  const source = "defillama_intents";
  const range30 = {
    days: 30,
    from: isoFromUnix(window[0][0]),
    to: isoFromUnix(window[window.length - 1][0]),
    dropped_last_day: drop,
  };
  return {
    chart: points,
    dropped: drop,
    volume_30d,
    numbers: {
      "intents.volume_30d": record("intents.volume_30d", {
        value: volume_30d,
        unit: "USD",
        range: range30,
        as_of,
        source,
        definition:
          "Sum of DefiLlama totalDataChart daily USD for near-intents over 30 days. The last day is dropped when total24h is null or it equals the previous day.",
      }),
      "intents.volume_all_time": record("intents.volume_all_time", {
        value: volume_all_time,
        unit: "USD",
        range: { all_time: true, to: isoFromUnix(points[points.length - 1][0]) },
        as_of,
        source,
        definition: "DefiLlama totalAllTime for near-intents.",
      }),
    },
  };
}

export async function loadDefillama({ file, metaPath, offline, fetchImpl }) {
  if (!offline) {
    await mkdir(dirname(file), { recursive: true });
    const text = await getText(DEFILLAMA_URL, fetchImpl);
    await writeFile(file, text);
    await writeFile(
      metaPath,
      `${JSON.stringify({ retrieved_at: new Date().toISOString() }, null, 2)}\n`,
    );
  }
  const as_of = JSON.parse(await readFile(metaPath, "utf8")).retrieved_at;
  const text = await readFile(file, "utf8");
  return intentsFromBody(text, as_of);
}
