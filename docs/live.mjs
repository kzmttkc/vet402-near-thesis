// Pure reading for the threshold bar. The browser dashboard and the daily job share it.
// No network and no Node built-ins, so docs/ can load this file on its own.

export const PREREGISTERED_POST = "https://near.social/smartbread5934.near/post/1794046390265";

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordValue(thesis, id) {
  return finite(thesis?.numbers?.[id]?.value);
}

// Frozen thesis.json. A finished relayer census wins. The known-account sum is
// the next floor. Until either file is present, the floor is the sample hits.
export function meterFromThesis(thesis) {
  const censusLower = recordValue(thesis, "near.relays.lower");
  const knownLower = recordValue(thesis, "near.known.lower");
  const censusUpper = recordValue(thesis, "near.relays.upper");
  const estimateRec = thesis?.numbers?.["near.delegate.estimate"] ?? null;
  const lower = censusLower ?? knownLower ?? recordValue(thesis, "near.delegate.sample_hits");
  const lowerKind = censusLower != null ? "census" : knownLower != null ? "known_relays" : "sample_hits";
  return {
    line: recordValue(thesis, "threshold.line"),
    lower,
    lower_kind: lowerKind,
    estimate: recordValue(thesis, "near.delegate.estimate"),
    upper: censusUpper ?? recordValue(thesis, "near.delegate.estimate_upper_95"),
    updated: estimateRec?.as_of ?? thesis?.snapshot?.near_retrieved_at ?? thesis?.generated_at ?? null,
    source: "frozen",
    relays_obtained: censusLower != null,
    date: null,
  };
}

// A missing or empty live file falls back to the frozen reading.
export function meterFromLive(live, thesis) {
  const frozen = meterFromThesis(thesis);
  if (live == null || typeof live !== "object" || Array.isArray(live)) return frozen;
  // A committed placeholder keeps the frozen numbers on disk so the page does not 404.
  // It is not a daily reading, and it does not replace the frozen meter.
  if (live.placeholder === true) return frozen;
  const hasAny = ["line", "lower", "estimate", "upper"].some((key) => finite(live[key]) != null);
  if (!hasAny) return frozen;
  return {
    line: finite(live.line),
    lower: finite(live.lower),
    lower_kind: typeof live.lower_kind === "string" ? live.lower_kind : null,
    estimate: finite(live.estimate),
    upper: finite(live.upper),
    updated: live.updated ?? null,
    source: "live",
    relays_obtained: live.relays_obtained === true,
    date: typeof live.date === "string" ? live.date : null,
  };
}

export function liveRecord(thesis, { relaysObtained = false, now = new Date() } = {}) {
  const base = meterFromThesis(thesis);
  const updated = thesis?.snapshot?.near_retrieved_at ?? base.updated ?? now.toISOString();
  return {
    date: now.toISOString().slice(0, 10),
    updated,
    line: base.line,
    lower: base.lower,
    lower_kind: base.lower_kind,
    estimate: base.estimate,
    upper: base.upper,
    relays_obtained: relaysObtained === true || base.relays_obtained === true,
    source: "live",
  };
}

// Positions on one bar, 0 at the left and the largest of the four numbers at the right.
export function meterPositions(reading) {
  const values = [reading?.line, reading?.lower, reading?.estimate, reading?.upper].filter(
    (number) => Number.isFinite(number) && number >= 0,
  );
  const max = Math.max(1, ...values);
  const at = (number) => (Number.isFinite(number) && number >= 0 ? (number / max) * 100 : null);
  return {
    max,
    line: at(reading?.line),
    lower: at(reading?.lower),
    estimate: at(reading?.estimate),
    upper: at(reading?.upper),
  };
}
