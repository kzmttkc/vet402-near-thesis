import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PREREG_RECORD, replayLabel, replaySteps } from "../docs/prereg.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the replay record is taken from PREREG-VERIFY.md and PREREG.md", () => {
  const verify = readFileSync(join(ROOT, "PREREG-VERIFY.md"), "utf8");
  const tx = verify.match(/Transaction: `([^`]+)`/);
  const signer = verify.match(/Signer: `([^`]+)`/);
  const receiver = verify.match(/Receiver: `([^`]+)`/);
  const method = verify.match(/Method: `([^`]+)`/);
  const block = verify.match(/Block: `(\d+)` \(block hash `([^`]+)`\), ([0-9T:Z-]+)/);
  const digest = verify.match(/The digest is `([0-9a-f]{64})`/);
  const commit = verify.match(/commit `([0-9a-f]{40})`/);
  const postKey = verify.match(/whose key is `([^`]+)`/);
  assert.ok(tx && signer && receiver && method && block && digest && commit && postKey);
  assert.equal(PREREG_RECORD.tx, tx[1]);
  assert.equal(PREREG_RECORD.signer, signer[1]);
  assert.equal(PREREG_RECORD.receiver, receiver[1]);
  assert.equal(PREREG_RECORD.method, method[1]);
  assert.equal(PREREG_RECORD.block, Number(block[1]));
  assert.equal(PREREG_RECORD.blockHash, block[2]);
  assert.equal(PREREG_RECORD.at, block[3]);
  assert.equal(PREREG_RECORD.digest, digest[1]);
  assert.equal(PREREG_RECORD.commit, commit[1]);
  assert.equal(PREREG_RECORD.postKey, postKey[1]);
  const bytes = readFileSync(join(ROOT, "PREREG.md"));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PREREG_RECORD.digest);
});

test("replay steps compare the file digest and do not invent a chain read", () => {
  const match = replaySteps(PREREG_RECORD, PREREG_RECORD.digest);
  assert.match(match[0], /does not call an RPC/);
  assert.match(match[1], new RegExp(PREREG_RECORD.tx));
  assert.match(match[1], new RegExp(String(PREREG_RECORD.block)));
  assert.match(match[3], /matches the posted digest/);
  const missing = replaySteps(PREREG_RECORD, null);
  assert.match(missing[3], /was not loaded/);
  assert.doesNotMatch(missing[3], /matches/);
  const wrong = replaySteps(PREREG_RECORD, "ab");
  assert.match(wrong[3], /does not match/);
  assert.equal(replayLabel(PREREG_RECORD.at), "Replay Nov 7 10:13 UTC");
});
