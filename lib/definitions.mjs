// One sentence set, used by README, the dashboard and data/thesis.json alike.
export const DEFINITIONS = {
  row: "A row in the vet402 observatory export.",
  attempt:
    "A row with a network. Rows without one never reached a payee and are counted separately as not_attempt.",
  not_attempt:
    "A row without a network: no_eligible_accept, over_cap, no_402, price_mismatch, no_fee_payer or payto_mismatch.",
  settled: "A row whose status is settled, with held_reason empty or settled_4xx.",
  delivered:
    "A settled row whose http_status_paid is 2xx, 202 Accepted included. The count without 202 is reported too. The public CSV has no column for an empty body, so a rerun cannot check that.",
  pending:
    "A row whose status is delivered_no_receipt (a 2xx answer with no tx yet) or settle_claimed (the seller named a tx that is not confirmed).",
  not_settled:
    "A row with a network whose status is settle_failed (payer_unfunded, unsettled_4xx or empty) or settle_claim_refuted.",
  held: "A settled row with held_reason settled_4xx. The 4xx may come from how vet402 asked, so vet402 leaves it out of its own rates.",
  unexplained: "A settled row that is neither 2xx nor held.",
};
