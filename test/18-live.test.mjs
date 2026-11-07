import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { liveRecord, meterFromLive, meterFromThesis, meterPositions } from "../docs/live.mjs";
import { appendLiveReading } from "../lib/live-write.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function thesisFixture() {
  return JSON.parse(readFileSync(join(ROOT, "docs", "thesis.json"), "utf8"));
}

test("with no live file the meter uses the frozen bounds", () => {
  const thesis = thesisFixture();
  const frozen = meterFromThesis(thesis);
  assert.equal(frozen.source, "frozen");
  assert.equal(frozen.line, 25_400);
  assert.equal(frozen.lower, 1716);
  assert.equal(frozen.lower_kind, "known_relays");
  assert.equal(Math.round(frozen.estimate), 20_421);
  assert.equal(frozen.upper, 42_675);
  assert.equal(frozen.relays_obtained, false);
  assert.equal(meterFromLive(null, thesis).source, "frozen");
  assert.equal(meterFromLive({}, thesis).source, "frozen");
  const pos = meterPositions(frozen);
  assert.ok(pos.lower < pos.estimate);
  assert.ok(pos.estimate < pos.line);
  assert.ok(pos.line < pos.upper);
  assert.equal(pos.upper, 100);
});

test("a census lower replaces the sample hits", () => {
  const thesis = {
    numbers: {
      "threshold.line": { value: 25_400 },
      "near.delegate.sample_hits": { value: 5 },
      "near.delegate.estimate": { value: 20_421, as_of: "2026-11-07T04:24:35.741Z" },
      "near.delegate.estimate_upper_95": { value: 42_675 },
      "near.relays.lower": { value: 12_000 },
      "near.relays.upper": { value: 42_675 },
    },
    snapshot: { near_retrieved_at: "2026-11-08T00:30:00.000Z" },
  };
  const frozen = meterFromThesis(thesis);
  assert.equal(frozen.lower, 12_000);
  assert.equal(frozen.lower_kind, "census");
  assert.equal(frozen.relays_obtained, true);
  assert.equal(frozen.upper, 42_675);
});

test("a dated live reading replaces the frozen bounds", () => {
  const thesis = thesisFixture();
  const live = {
    date: "2026-11-08",
    updated: "2026-11-08T00:30:00.000Z",
    line: 25_400,
    lower: 1000,
    lower_kind: "census",
    estimate: 22_000,
    upper: 40_000,
    relays_obtained: true,
    source: "live",
  };
  const got = meterFromLive(live, thesis);
  assert.equal(got.source, "live");
  assert.equal(got.lower, 1000);
  assert.equal(got.estimate, 22_000);
  assert.equal(got.upper, 40_000);
  assert.equal(got.line, 25_400);
  assert.equal(got.updated, "2026-11-08T00:30:00.000Z");
  const pos = meterPositions(got);
  assert.ok(pos.lower < pos.estimate);
  assert.ok(pos.estimate < pos.line);
  assert.ok(pos.line < pos.upper);
});

test("a live record is one UTC day and a later day does not delete the earlier file", async () => {
  const thesis = thesisFixture();
  const record = liveRecord(thesis, { relaysObtained: false, now: new Date("2026-11-08T00:30:00.000Z") });
  assert.equal(record.date, "2026-11-08");
  assert.equal(record.source, "live");
  assert.equal(record.relays_obtained, false);
  assert.equal(record.lower, 1716);
  assert.equal(record.line, 25_400);
  const root = await mkdtemp(join(tmpdir(), "near-live-"));
  await appendLiveReading({ thesis, root, now: new Date("2026-11-08T00:30:00.000Z") });
  await appendLiveReading({
    thesis,
    root,
    relaysObtained: true,
    now: new Date("2026-11-09T00:30:00.000Z"),
  });
  const names = (await readdir(join(root, "data", "live"))).sort();
  assert.deepEqual(names, ["2026-11-08.json", "2026-11-09.json"]);
  const shown = JSON.parse(await readFile(join(root, "docs", "live.json"), "utf8"));
  assert.equal(shown.date, "2026-11-09");
  const first = JSON.parse(await readFile(join(root, "data", "live", "2026-11-08.json"), "utf8"));
  assert.equal(first.date, "2026-11-08");
  assert.equal(first.lower, 1716);
});

test("named facilitators with zero settlements sit with the claim", () => {
  const thesis = readFileSync(join(ROOT, "THESIS.md"), "utf8");
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const claim = thesis.indexOf("## Claim");
  const impact = thesis.indexOf("### Impact");
  const against = thesis.indexOf("## Evidence against");
  const zero = thesis.indexOf("settled 0 x402 payments");
  assert.ok(claim !== -1 && claim < zero && zero < impact);
  assert.ok(zero < against);
  assert.match(thesis.slice(claim, impact), /uvd-facilitator\.near` signed 51 transactions/);
  assert.match(thesis.slice(claim, impact), /Delegate USDC `ft_transfer` count is 0/);
  assert.doesNotMatch(thesis.slice(against, thesis.indexOf("## What would change my mind")), /settled 0 x402 payments/);
  const generic = thesis.indexOf("It is a generic relay.");
  assert.ok(against < generic);
  assert.match(thesis, /not named by any facilitator `\/supported` response/);
  assert.match(thesis, /not known to be x402/);
  assert.match(thesis, /the whole of this lower bound/);
  assert.match(readme, /settled 0 x402 payments/);
  assert.match(readme, /It is a generic relay\./);
  assert.match(readme, /counted only as a lower bound on N/);
  for (const page of [thesis, readme]) {
    const appendix = page.indexOf("## Appendix: biased sample estimate");
    assert.ok(appendix > page.indexOf("not decided"));
    assert.equal(page.slice(0, appendix).includes("20,421"), false);
    assert.equal(page.slice(0, appendix).includes("42,675"), false);
    assert.match(page.slice(appendix), /20,421/);
    assert.match(page.slice(appendix), /42,675/);
    assert.match(page.slice(appendix), /not used in the claim/);
  }
  assert.match(thesis, /1,716 is 6\.8% of that line/);
  assert.match(thesis, /cannot be measured without a key/);
  assert.match(readme, /6\.8% of the line/);
});

test("the upkeep sentence says the counts are fetched again each day", () => {
  const sentence = "Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of 25,400.";
  const thesis = readFileSync(join(ROOT, "THESIS.md"), "utf8");
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  assert.equal(thesis.includes(sentence), true);
  assert.equal(readme.includes(sentence), true);
  const thesisAt = thesis.indexOf("### Sustainability");
  const thesisNext = thesis.indexOf("## Evidence for");
  assert.ok(thesisAt !== -1 && thesisAt < thesis.indexOf(sentence) && thesis.indexOf(sentence) < thesisNext);
  const watch = readme.indexOf("## 7. What I watch");
  const windows = readme.indexOf("The windows do not line up");
  assert.ok(watch !== -1 && watch < readme.indexOf(sentence) && readme.indexOf(sentence) < windows);
});

test("the daily workflow runs the two fetches apart and does not open a pull request", async () => {
  const yml = await readFile(join(ROOT, ".github", "workflows", "refresh.yml"), "utf8");
  assert.match(yml, /cron:\s*"30 0 \* \* \*"/);
  assert.match(yml, /node thesis\.mjs --fetch-near/);
  assert.match(yml, /node thesis\.mjs --fetch-relays/);
  assert.doesNotMatch(yml, /--fetch-near[^\n]*--fetch-relays/);
  assert.doesNotMatch(yml, /--fetch-relays[^\n]*--fetch-near/);
  assert.doesNotMatch(yml, /secrets\./);
  assert.doesNotMatch(yml, /pull_request/);
  assert.match(yml, /data\/live/);
  assert.match(yml, /docs\/live\.json/);
  const failed = yml.indexOf("fetch-near failed");
  const write = yml.indexOf("node lib/live-write.mjs");
  const near = yml.indexOf("node thesis.mjs --fetch-near");
  assert.ok(near !== -1 && failed !== -1 && write !== -1);
  assert.ok(near < failed && failed < write);
});
