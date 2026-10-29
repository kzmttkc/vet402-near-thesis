// annual_near_usd = x402_30d_usd * 12 * multiple * pass_through * (cumulative_fees_usd / cumulative_intents_usd) * take_rate
// The fee rate divides cumulative fees by cumulative volume, so both cover the same period. The Q3 figure only feeds the DefiLlama gap note.
export const MODEL_FORMULA =
  "annual_near_usd = x402_30d_usd * 12 * multiple * pass_through * (cumulative_fees_usd / cumulative_intents_usd) * take_rate";

const MULTIPLES = [1, 10, 100, 1000];
const PASSES = [
  { id: "pass_1pct", rate: 0.01 },
  { id: "pass_10pct", rate: 0.1 },
  { id: "pass_50pct", rate: 0.5 },
];

const INPUT_KEYS = ["q3_intents_usd", "cumulative_intents_usd", "cumulative_fees_usd", "buyback_usd", "take_rate"];

export function formatRatioPercent(ratio) {
  return `${(ratio * 100).toFixed(3)}%`;
}

export function readModelInputs(text) {
  if (text == null) return null;
  const trimmed = String(text).trim();
  if (trimmed === "" || trimmed === "null") return null;
  const parsed = JSON.parse(trimmed);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (INPUT_KEYS.some((key) => parsed[key] == null || parsed[key] === "")) return null;
  const inputs = {};
  for (const key of INPUT_KEYS) {
    const number = Number(parsed[key]);
    if (!Number.isFinite(number)) return null;
    inputs[key] = number;
  }
  if (inputs.take_rate > 1) inputs.take_rate = inputs.take_rate / 100;
  return inputs;
}

function sumQ3(chart) {
  if (!Array.isArray(chart)) return null;
  const from = Date.UTC(2026, 6, 1) / 1000;
  const to = Date.UTC(2026, 9, 1) / 1000;
  const values = [];
  for (const row of chart) {
    let ts = Number(row[0]);
    if (ts > 1e12) ts = Math.floor(ts / 1000);
    if (ts >= from && ts < to) values.push(Number(row[1]));
  }
  if (values.length < 90) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

export function annualNear({ x402_30d_usd, multiple, pass_through, cumulative_intents_usd, cumulative_fees_usd, take_rate }) {
  const feeRate = cumulative_fees_usd / cumulative_intents_usd;
  return x402_30d_usd * 12 * multiple * pass_through * feeRate * take_rate;
}

export function buildModel({ x402_30d_usd, intents_30d_usd, inputs, chart }) {
  if (!(intents_30d_usd > 0)) {
    throw new Error("intents 30d volume is 0");
  }
  const ratio = x402_30d_usd / intents_30d_usd;
  const header = {
    x402_over_intents_30d: ratio,
    x402_over_intents_30d_display: formatRatioPercent(ratio),
    x402_30d_usd,
    intents_30d_usd,
    formula: MODEL_FORMULA,
  };
  if (!inputs) {
    return { ...header, table: null };
  }
  const q3Sum = sumQ3(chart);
  const q3Note =
    q3Sum == null
      ? "DefiLlama daily series in this snapshot does not cover 2026-07-01 through 2026-09-30, so the Q3 gap is not recomputed."
      : "Q3 gap is (official Q3 Intents - DefiLlama daily sum) / official Q3 Intents. Fee rate is cumulative fees over cumulative Intents volume.";
  const table = [];
  for (const multiple of MULTIPLES) {
    for (const pass of PASSES) {
      table.push({
        multiple,
        pass_through: pass.rate,
        annual_near_usd: annualNear({
          x402_30d_usd,
          multiple,
          pass_through: pass.rate,
          cumulative_intents_usd: inputs.cumulative_intents_usd,
          cumulative_fees_usd: inputs.cumulative_fees_usd,
          take_rate: inputs.take_rate,
        }),
        assumption_ids: ["annualize_30d_x12", `multiple_${multiple}`, pass.id, "fee_rate_cumulative", "take_rate"],
      });
    }
  }
  return {
    ...header,
    inputs,
    fee_rate: inputs.cumulative_fees_usd / inputs.cumulative_intents_usd,
    buyback_over_fees: inputs.buyback_usd / inputs.cumulative_fees_usd,
    q3_defillama_usd: q3Sum,
    q3_gap: q3Sum == null ? null : (inputs.q3_intents_usd - q3Sum) / inputs.q3_intents_usd,
    note: q3Note,
    table,
  };
}
