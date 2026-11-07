import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIGEST = "d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec";

test("PREREG.md is the posted THESIS.md, byte for byte", () => {
  const bytes = readFileSync(join(ROOT, "PREREG.md"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, DIGEST);
  assert.match(bytes.toString("utf8"), /before any NEAR data was fetched/);
});

test("the current pages point at the check and do not say the post was before any NEAR data", () => {
  const thesis = readFileSync(join(ROOT, "THESIS.md"), "utf8");
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  assert.match(thesis, /before the full count \(N\) was seen/);
  assert.match(thesis, /\[PREREG-VERIFY\.md\]\(PREREG-VERIFY\.md\)/);
  assert.match(readme, /\[PREREG-VERIFY\.md\]\(PREREG-VERIFY\.md\)/);
  assert.doesNotMatch(thesis, /before any NEAR data was fetched/);
  assert.doesNotMatch(readme, /before any NEAR data was fetched/);
  const verify = readFileSync(join(ROOT, "PREREG-VERIFY.md"), "utf8");
  assert.match(verify, /BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB/);
  assert.match(verify, /223452268/);
  assert.match(verify, new RegExp(DIGEST));
  assert.match(verify, /10:13 UTC is before the full-count fetch and after the NEAR sample fetch \(2026-11-07 04:24 to 05:28 UTC\)/);
  assert.match(verify, /lower bound of accounts whose names are known/);
  assert.match(verify, /one known x402 facilitator relayer/);
  assert.match(readme, /git tag prereg-threshold f0c48d13ed5af6147daa0e7a0b444855f3186770/);
  assert.doesNotMatch(verify, /It is still a free public count of N/);
});
