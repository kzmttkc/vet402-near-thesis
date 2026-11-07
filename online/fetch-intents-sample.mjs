// One sample of recent intents.near index rows.
// Public reads only: POST https://tx.main.fastnear.com/v0/account and /v0/transactions.
// No key, no account, no mainnet write.

import { readFile, writeFile } from "node:fs/promises";
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

function printSample(view) {
  console.log(
    `intents sample ${view.sample_rows} rows, payment_count ${view.payment_count}, blocks ${view.height_min} to ${view.height_max}, ${view.from} to ${view.to} UTC`,
  );
}

if (process.argv.includes("--offline")) {
  printSample(intentsPaymentView(readStampedIntentsSample(await readFile(out, "utf8"))));
} else {
  const { post } = makeFastnear({
    pauseMs: 400,
    log: (line) => console.error(line),
  });
  const doc = await collectIntentsSample(post);
  await writeFile(out, stampIntentsSample(doc));
  printSample(intentsPaymentView(readStampedIntentsSample(stampIntentsSample(doc))));
}
