# Thesis

The four sections follow the NEAR HACKATHON thesis track. The threshold in "What would change my mind" was committed on its own, before the full count (N) was seen, in commit f0c48d1. The on-chain post (block 223452268, 2026-11-07 10:13 UTC) is the timestamp a third party can check. Commit f0c48d1 is tagged `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the posted digest. The same commit and the SHA-256 of that THESIS.md (d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec) were posted on NEAR at 2026-11-07 10:13 UTC, before the full relayer count ran: https://near.social/smartbread5934.near/post/1794046390265. The check, and the words that changed after the post, are in [PREREG-VERIFY.md](PREREG-VERIFY.md).

## Claim

NEAR's edge in agent payments is the funding and settlement layer. NEAR Intents volume was {{n:intents.volume_30d|M}} {{range:intents.volume_30d}} (retrieved {{asof:intents.volume_30d}} UTC). DefiLlama totalDataChart, 2026-09-29 to 2026-10-29 UTC. That volume is not a count of agent payments. x402 has had a NEAR settlement spec since {{field:near.spec.pr_merged_at}} UTC.

The known x402 facilitators, `x402-relayer2.mike.near`, `x402-relayer.mike.near`, `solvador.near`, and `uvd-facilitator.near`, settled {{n:near.known.named_delegate}} exact-scheme payments {{range:near.known.lower}}.

`uvd-facilitator.near` signed {{n:near.known.uvd_signer_txs}} transactions in that window: {{n:near.known.uvd_ft_transfer_call}} Delegate `ft_transfer_call` to NEAR USDC and {{n:near.known.uvd_escrow_calls}} calls on `v1.arras-escrow.near` ({{n:near.known.uvd_withdraw_for}} `withdraw_for`, {{n:near.known.uvd_release}} `release`, {{n:near.known.uvd_refund}} `refund`). Those may be an escrow scheme of x402. This page does not classify them as x402 or as not x402. Its exact-scheme Delegate USDC `ft_transfer` count is {{n:near.known.uvd_delegate}}.

The exact-scheme spec is merged and the facilitators are named, yet they settled {{n:near.known.named_delegate}} exact-scheme payments in the 30 days of the census window. That gap is the strongest evidence that the exact scheme has not lit. The upper bound on N is {{n:near.bq.n_upper_bound}}, the count on the 31 whole dates that contain the window, below the line (How the result is read).

### Impact

The people this reaches are agents that pay through x402, and the accounts that fund them. x402scan counted {{n:threshold.base_count_30d}} payments on Base over 30 days. The Intents treasury on Base sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers. Those transfers have no label, so they are not an x402 count. The known relay accounts sum to {{n:near.known.lower}}. That sum is a lower bound on N, and it is {{n:near.known.lower_share_of_line}} of the line. All of that sum comes from `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`, a generic relay not named by `/supported`, and those transfers are not known to be x402. The upper bound on N is {{n:near.bq.n_upper_bound}}, below the line (How the result is read).

### Sustainability

Every figure here rebuilds from the frozen snapshot with `node thesis.mjs --offline`, with no key and no account. That command's one line ends with `N ≤ {{n:near.bq.n_upper_bound}} < {{n:threshold.line}}: the threshold is not crossed (BigQuery bound, frozen)`. While `relay-census.json` is absent, the line adds `relay census not fetched`. The line was fixed in commit f0c48d1 from the Base count frozen on 2026-10-30, so a later NEAR fetch cannot move it. The timing of the post is in [PREREG-VERIFY.md](PREREG-VERIFY.md). `node thesis.mjs --fetch-relays` counts the known relay accounts through the FastNEAR transaction API and writes `data/snapshot/near/facilitators.json`. It does not page every USDC transfer. The upkeep is to run the same script on the next 30-day window. `.github/workflows/refresh.yml` fetches the public counts with no key on a daily schedule. The schedule was turned on at publication, 2026-11-07 20:27 UTC. When it runs, the dashboard shows when the counts move toward the line of {{n:threshold.line}}.

## Evidence for

The NEAR exact scheme is in the canonical repository x402-foundation/x402, file `specs/schemes/exact/scheme_exact_near.md`, merged in PR {{field:near.spec.pr_number}} at {{field:near.spec.pr_merged_at}} UTC. The frozen copy contains the sentence that outer-transaction success is not sufficient. On this page that fact is {{n:near.spec.settlement_sentence}}, where 1 means the sentence is present. Source: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_near.md

That sentence is the same shape one layer up. The spec says a successful outer transaction does not mean the inner transfer succeeded. vet402's record says a settled payment does not mean the answer was delivered. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled, and {{n:vet402.delivered}} of the settled purchases came back with an HTTP 2xx answer. A payment and a delivered answer are two records.

NEAR Intents settles cross-chain payments through its solver network. The frozen page is https://mpp.dev/payment-methods/nearintents. The client library named there is `@defuse-protocol/nearintents-mpp-sdk`. The snapshot has the page and no payment count.

The public facilitator at x402.mikedotexe.com reports scheme `exact` on `near:mainnet` and names `x402-relayer2.mike.near` as a signer. NEAR Intents volume was {{n:intents.volume_30d|M}} {{range:intents.volume_30d}} (retrieved {{asof:intents.volume_30d}} UTC). That window is not the window of the N lower bound ({{range:near.known.lower}}) or of the sample ({{range:near.delegate.sampled_receipts}}). On Base, the Intents treasury address sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers over {{range:vault.usdc_out_30d.usd}}. This is the funding and movement layer. Nothing in those transfers says which of them, if any, are x402.

Three rails move value on NEAR. NEAR Intents moves it through solvers ({{n:intents.volume_30d|M}} in the window above). The x402 exact scheme is a NEP-366 delegate ft_transfer of NEAR USDC that a facilitator submits; N counts only this rail. Chain Signatures let a NEAR account sign on another chain; this thesis does not count that rail.

## Evidence against

I read {{n:near.intents.sample_rows}} intents.near index rows, 30 a day from 16:20 UTC over {{n:near.intents.points}} days ({{range:near.intents.sample_rows}}), from FastNEAR with no key. Payment-scale settlements, meaning a successful transfer intent of NEAR USDC of 5 USDC or less: {{n:near.intents.payment_count}}. Days not fetched: {{field:near.intents_sample.unavailable_label}}. This count is not the delegate-action count N.

The opt-in discovery catalog at x402.mikedotexe.com lists {{n:near.facilitator.discovery_total}} resources. Sellers add themselves to that list. Zero there means zero listings, not zero sellers.

The one named relayer, `x402-relayer2.mike.near`, has {{n:near.relayer.payments}} delegate payments in the frozen receipt list. The smallest is {{n:near.relayer.payment_usdc_min}} USDC and the largest is {{n:near.relayer.payment_usdc_max}} USDC. They go from {{field:near.relayer.payment_senders}} to {{field:near.relayer.payment_receivers}}, and the last one is {{field:near.relayer.payment_last_at}} UTC. These are the operator's own accounts. They sit before the 30-day window used for N, so they are not that count. As of 2026-11-07, they are the only payments through that relayer I can point at.

N, the 30-day count of delegate-action USDC `ft_transfer`s, is bounded above. The known relay accounts sum to {{n:near.known.lower}} {{range:near.known.lower}}. That sum is the complete 30-day count for the accounts this survey named, and it is a lower bound on N. All {{n:near.delegate.sample_hits}} delegate-shaped hits in the frozen sample are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That account is not named by any facilitator `/supported` response. It is a generic relay. Its {{n:near.known.generic_delegate}} delegate-action USDC `ft_transfer`s are not known to be x402. They are the whole of this lower bound. The line is {{n:threshold.line}}. {{n:near.known.lower}} is {{n:near.known.lower_share_of_line}} of that line. The upper bound on N is {{n:near.bq.n_upper_bound}}, below the line (How the result is read). A delegate `ft_transfer` in that upper bound is not, on its own, an x402 payment. N includes transfers that are not x402, so the count is tilted against the claim. The biased sample estimate is in the appendix. It is not used in the claim.

`escrow.ai.near` signed {{n:near.escrow.txs}} `execute_intents` transactions in one short sample, {{range:near.escrow.txs}}. After removing retries, {{n:near.escrow.unique_intents}} intents remain: {{n:near.escrow.intents_success}} succeeded, {{n:near.escrow.intents_invalid_intent}} were invalid, {{n:near.escrow.intents_insufficient_balance}} lacked balance, and {{n:near.escrow.intents_other}} failed for another reason. That this account is the NEAR AI Agent Market escrow is an estimate. The sample is not 30 days, and it is not a pillar of the claim.

## What would change my mind

**Threshold committed before data.**

My claim is that NEAR's edge in agent payments is the funding and settlement layer (NEAR Intents), and that x402 settlement on NEAR itself is specified but not yet in use. I will drop the second half and say "x402 settlement is itself a place where NEAR earns" if this holds:

> **N ≥ {{n:threshold.line}}**, where N is the number of NEAR delegate-action USDC transfers in a 30-day window, and {{n:threshold.line}} is 1% of the x402 payments counted on Base over 30 days.

### N, the NEAR count (an upper bound on x402 on NEAR)

N counts NEAR transactions in which all of these are true:

1. The transaction carries a `Delegate` action (NEP-366 meta-transaction, `DELEGATE_ACTION` in NearBlocks).
2. The delegate action's `receiver_id` is the NEAR USDC contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`.
3. The delegate action holds exactly one action, a `FunctionCall` to `ft_transfer`.
4. The inner `ft_transfer` receipt succeeded.
5. The transaction's block time falls in the 30 days that end at the moment of the fetch.

This is the exact shape the x402 NEAR scheme requires (x402-foundation/x402, `specs/schemes/exact/scheme_exact_near.md`, section "Delegated Action Safety": one action, `ft_transfer`, `receiver_id` equal to the asset). Every x402 payment in NEAR USDC is in N. This holds for the exact scheme. Escrow-scheme calls such as uvd-facilitator.near's are outside N. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound. A higher N can only make me change my mind sooner.

The known-account sum is in `data/snapshot/near/facilitators.json` (sha256 `{{field:near.known.sha256}}`). That digest is the file with its `sha256` field set to "". `shasum -a 256` of the file itself prints `{{field:near.known.file_sha256}}`. The sum was counted with the FastNEAR transaction API (`node thesis.mjs --fetch-relays`). Each opened transaction is counted once. `data/snapshot/near/relay-census.json` is not frozen, so that sum is not all of N. The five sample hits share one signer. That signer's 30 days are inside the sum, and other signers can still exist. The upper bound for every account is {{n:near.bq.n_upper_bound}}, below the line (How the result is read), in `data/snapshot/near/bigquery-n-upper-bound.json`.

### The Base count, frozen before this threshold

The Base count is x402scan `total_transactions` for `chain: base`, `timeframe: 30`, read from the file already in this repository:

- File: `data/snapshot/x402scan/base.json`, sha256 `9bc61df7abfbbb3f96b511503ce2d52481118b4b34cbdbc414afc4c1671fa55e`
- Window: 30 days to `2026-10-29T22:45:39Z` (`latest_block_timestamp`), retrieved `2026-10-29T23:18:32Z`
- Value: {{n:threshold.base_count_30d}} payments. The line is the next whole number above 1% of that count, **{{n:threshold.line}}**.

This number does not change when the NEAR data is fetched again. The windows do not match by date (Base to 10/29, NEAR to the day of the fetch), and that gap is accepted as part of the rule.

### How the result is read

- **N ≥ {{n:threshold.line}}**: the threshold is crossed. I change my mind as stated above.
- **N < {{n:threshold.line}}, all 30 days counted**: the threshold is not crossed. The claim stands.
- **Only part of the 30 days could be counted without a key**: the snapshot states the range counted and why the count stopped. If the partial count is already at least {{n:threshold.line}}, the threshold is crossed, because a partial count is never larger than the full one. If it is below {{n:threshold.line}}, the result is "not decided", and I do not report it as a pass.

The lower bound is the sum of the known relay accounts, {{n:near.known.lower}}. That is {{n:near.known.lower_share_of_line}} of the line. The upper bound on N is {{n:near.bq.n_upper_bound}}, the distinct count on the whole dates 2026-10-08 through 2026-11-07, counted at {{field:near.bq.retrieved_at}} UTC from `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`. Those dates contain the census window. The inner `ft_transfer` receipt is not required to succeed, so the figure is at least N. All {{field:near.bq.dates_present}} dates are present, and the last block on the end date is {{field:near.bq.last_block}}, after the census end, so all 30 days are counted. N ≤ {{n:near.bq.n_upper_bound}} < {{n:threshold.line}}. N < {{n:threshold.line}}, all 30 days counted: the threshold is not crossed. The claim stands. The minute-cut window count is {{n:near.bq.minute_window}}. The sum of the daily counts is {{n:near.bq.sum_of_daily}}, because {{n:near.bq.receipts_on_two_dates}} receipts appear on two dates. The query processed {{field:near.bq.bytes_processed}} inside the BigQuery free tier. PREREG.md named free sources that need no key. Keyless, I reached only the known-relay sum, {{n:near.known.lower}}, which covers the named accounts and not every account. The posted rule reads that partial count as not decided. This upper bound is BigQuery public data, and that query needs a Google Cloud account. The result is frozen in `data/snapshot/near/bigquery-n-upper-bound.json`. The known-relay sum does not change the rule. The line stays {{n:threshold.line}}. While `relay-census.json` is absent, `--offline` prints `full count not yet fetched` and keeps the sample estimate in the appendix.

## Appendix: biased sample estimate

This estimate is a reference. It is not used in the claim.

The frozen sample took {{n:near.delegate.sampled_receipts}} USDC `ft_transfer` receipts at 30 points, 15 at each point, and found {{n:near.delegate.sample_hits}} of the delegate shape. All {{n:near.delegate.sample_hits}} are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That signer's complete 30-day delegate-action count is {{n:near.known.generic_delegate}}. The sample share is about {{n:near.delegate.sample_over_signer}} times that signer's share of {{n:near.delegate.transfers_30d}} USDC transfer events of every shape, so the sample over-represents that signer. All 30 sample points fall at 16:24 UTC, because the window opened at 04:24, the first point is half a day after that, and each later point is one day after the one before. Scaling the sample share by those events gives {{n:near.delegate.estimate}}, rounded to the nearest transfer. The one-sided 95% upper bound, assuming independent draws (the sample is 30 clusters of 15 receipts, so this is optimistic), is {{n:near.delegate.estimate_upper_95}}. Neither number is N. The {{n:near.delegate.transfers_30d}} figure counts every transfer shape, so it is larger than N and is not N.
