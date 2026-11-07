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
});
