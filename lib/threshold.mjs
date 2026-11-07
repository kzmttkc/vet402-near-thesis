// The line in THESIS.md "What would change my mind", committed before any NEAR data.
// It is fixed here so a later x402scan refetch cannot move it.
export const THRESHOLD = Object.freeze({
  base_file: "data/snapshot/x402scan/base.json",
  base_file_sha256: "9bc61df7abfbbb3f96b511503ce2d52481118b4b34cbdbc414afc4c1671fa55e",
  base_count_30d: 2539947,
  base_range_to: "2026-10-29T22:45:39.000Z",
  base_retrieved_at: "2026-10-29T23:18:32.677Z",
  share: 0.01,
});

// N must be strictly above 1% of the Base count, so the line is the next whole number.
export function thresholdLine(baseCount = THRESHOLD.base_count_30d) {
  return Math.floor(baseCount / 100) + 1;
}

// The reading rule in THESIS.md. `complete` says whether all 30 days were counted.
export function judgeThreshold({ counted, complete, line = thresholdLine() }) {
  if (counted >= line) return "crossed";
  if (complete) return "not_crossed";
  return "not_decided";
}
