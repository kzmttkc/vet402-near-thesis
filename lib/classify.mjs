export const KNOWN_TRIPLES = [
  { status: "no_eligible_accept", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "over_cap", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "no_402", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "price_mismatch", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "no_fee_payer", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "payto_mismatch", held_reason: "", networkEmpty: true, category: "4-not-an-attempt" },
  { status: "settle_failed", held_reason: "unsettled_4xx", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_failed", held_reason: "", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_failed", held_reason: "payer_unfunded", networkEmpty: false, category: "1-not-settled" },
  { status: "settle_claim_refuted", held_reason: "", networkEmpty: false, category: "1-not-settled" },
  { status: "delivered_no_receipt", held_reason: "", networkEmpty: false, category: "2-pending" },
  { status: "settle_claimed", held_reason: "", networkEmpty: false, category: "2-pending" },
  { status: "settled", held_reason: "", networkEmpty: false, category: "3-settled" },
  { status: "settled", held_reason: "settled_4xx", networkEmpty: false, category: "3-settled" },
];

function tripleKey(status, held_reason, networkEmpty) {
  return `${status}\0${held_reason}\0${networkEmpty ? "empty" : "set"}`;
}

const TABLE = new Map(KNOWN_TRIPLES.map((t) => [tripleKey(t.status, t.held_reason, t.networkEmpty), t]));

export function isHttp2xx(http_status_paid) {
  const n = Number(http_status_paid);
  return Number.isInteger(n) && n >= 200 && n <= 299;
}

export function classify(row) {
  const status = row.status ?? "";
  const held_reason = row.held_reason ?? "";
  const networkEmpty = !row.network;
  const entry = TABLE.get(tripleKey(status, held_reason, networkEmpty));
  if (!entry) {
    throw new Error(
      `unknown combination: status=${JSON.stringify(status)} held_reason=${JSON.stringify(held_reason)} network=${networkEmpty ? "empty" : "set"}`,
    );
  }
  const http_2xx = isHttp2xx(row.http_status_paid);
  const httpNum = Number(row.http_status_paid);
  const has_tx = Boolean(row.tx_hash);
  const attempt = !networkEmpty;
  const settled = status === "settled";
  const held = settled && held_reason === "settled_4xx";
  const delivered = settled && http_2xx;
  const unexplained = settled && !http_2xx && !held;
  return {
    category: entry.category,
    attempt,
    settled,
    delivered,
    delivered_excl_202: delivered && httpNum !== 202,
    held,
    unexplained,
    has_tx,
    http_2xx,
    status,
    held_reason,
  };
}

export function summarize(rows) {
  const counts = {
    rows: 0,
    attempts: 0,
    not_attempts: 0,
    not_settled: 0,
    pending: 0,
    settled: 0,
    held: 0,
    delivered: 0,
    delivered_excl_202: 0,
    unexplained: 0,
    cat1: 0,
    cat2: 0,
    cat3: 0,
    cat4: 0,
  };
  const buckets = new Map();
  let minAt = null;
  let maxAt = null;
  for (const row of rows) {
    const got = classify(row);
    counts.rows += 1;
    if (got.attempt) counts.attempts += 1;
    else counts.not_attempts += 1;
    if (got.category === "1-not-settled") {
      counts.not_settled += 1;
      counts.cat1 += 1;
    } else if (got.category === "2-pending") {
      counts.pending += 1;
      counts.cat2 += 1;
    } else if (got.category === "3-settled") {
      counts.settled += 1;
      counts.cat3 += 1;
    } else if (got.category === "4-not-an-attempt") {
      counts.cat4 += 1;
    }
    if (got.held) counts.held += 1;
    if (got.delivered) counts.delivered += 1;
    if (got.delivered_excl_202) counts.delivered_excl_202 += 1;
    if (got.unexplained) counts.unexplained += 1;
    const at = row.attempted_at ?? "";
    if (at) {
      if (minAt === null || at < minAt) minAt = at;
      if (maxAt === null || at > maxAt) maxAt = at;
    }
    const bkey = `${got.category}\0${got.status}\0${got.held_reason}\0${got.has_tx}\0${got.http_2xx}`;
    const prev = buckets.get(bkey);
    if (prev) prev.count += 1;
    else {
      buckets.set(bkey, {
        category: got.category,
        status: got.status,
        held_reason: got.held_reason,
        has_tx: got.has_tx,
        http_2xx: got.http_2xx,
        count: 1,
      });
    }
  }
  const breakdown = [...buckets.values()].sort((a, b) => {
    const parts = [
      a.category.localeCompare(b.category),
      a.status.localeCompare(b.status),
      a.held_reason.localeCompare(b.held_reason),
      Number(a.has_tx) - Number(b.has_tx),
      Number(a.http_2xx) - Number(b.http_2xx),
    ];
    return parts.find((n) => n !== 0) ?? 0;
  });
  const checks = [
    {
      name: "groups 1 to 4 add up to all rows",
      ok: counts.cat1 + counts.cat2 + counts.cat3 + counts.cat4 === counts.rows,
    },
    {
      name: "attempts equal groups 1 + 2 + 3",
      ok: counts.attempts === counts.cat1 + counts.cat2 + counts.cat3,
    },
  ];
  return {
    counts,
    breakdown,
    checks,
    range: { from: minAt, to: maxAt },
  };
}
