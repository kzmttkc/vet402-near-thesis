export const DEFINITIONS = {
  row: "A row in the vet402 observatory export.",
  attempt:
    "A row whose network is non-empty. Rows with empty network (no_eligible_accept and similar cases where there was no payee) are excluded from the attempt count; their count is reported separately.",
  not_attempt: "A row whose network is empty.",
  settled: "A row whose status is settled (both empty held_reason and settled_4xx).",
  delivered:
    "A settled row whose http_status_paid is 2xx. Includes 202 Accepted. The count excluding 202 is also reported. Whether the body was empty cannot be checked from the public CSV (that column is absent) and cannot be verified on re-run.",
  pending:
    "A row whose status is delivered_no_receipt (treated as delivered without a receipt; all 2xx with no tx) or settle_claimed (the seller named a tx).",
  not_settled:
    "settle_failed (payer_unfunded, unsettled_4xx, or empty), settle_claim_refuted, over_cap, price_mismatch, payto_mismatch, no_fee_payer, no_402.",
  held: "settled with held_reason=settled_4xx. The portion vet402 itself excludes from the denominator.",
  unexplained: "Settled rows that are neither 2xx nor settled_4xx.",
};
