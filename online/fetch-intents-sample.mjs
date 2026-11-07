// One sample of recent intents.near index rows.
// Public reads only: POST https://tx.main.fastnear.com/v0/account and /v0/transactions.
// No key, no account, no mainnet write.

import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFastnear } from "../lib/sources/fastnear-census.mjs";
import {
  collectIntentsSample,
  INTENTS_SAMPLE_FILE,
  intentsPaymentView,
  readStampedIntentsSample,
  stampIntentsSample,
} from "../lib/sources/intents-sample.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "snapshot", "near", INTENTS_SAMPLE_FILE);
const progressPath = join(tmpdir(), "vet402-intents-30d.json");

function printSample(view) {
  console.log(
    `intents sample ${view.sample_rows} rows, payment_count ${view.payment_count}, blocks ${view.height_min} to ${view.height_max}, ${view.from} to ${view.to} UTC, unavailable ${view.unavailable_label}`,
  );
}

if (process.argv.includes("--offline")) {
  printSample(intentsPaymentView(readStampedIntentsSample(await readFile(out, "utf8"))));
} else {
  const { post } = makeFastnear({
    pauseMs: 150,
    log: (line) => console.error(line),
  });
  let prior = null;
  try {
    prior = JSON.parse(await readFile(progressPath, "utf8"));
  } catch {
    prior = null;
  }
  let announced = false;
  const doc = await collectIntentsSample(post, {
    prior,
    onPoint: async (state) => {
      if (!announced) {
        console.error(`tip ${state.tip.at} height ${state.tip.height}`);
        announced = true;
      }
      const last = state.points[state.points.length - 1];
      console.error(`${last.date} ${last.status} ${last.reason ?? `${last.rows} rows from ${last.first_at}`}`);
      const tmp = `${progressPath}.tmp`;
      await writeFile(tmp, JSON.stringify(state));
      await rename(tmp, progressPath);
    },
  });
  if (doc.sample_rows === 0) throw new Error("intents sample fetched no rows");
  const stamped = stampIntentsSample(doc);
  await writeFile(out, stamped);
  printSample(intentsPaymentView(readStampedIntentsSample(stamped)));
}
