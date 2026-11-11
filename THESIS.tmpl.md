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

Three rails move value on NEAR. NEAR Intents moves it through solvers ({{n:intents.volume_30d|M}} in the window above). The x402 exact scheme is a NEP-366 delegate ft_transfer of NEAR USDC that a facilitator submits. N counts every delegate ft_transfer of NEAR USDC, x402 or not, so it is an upper bound on this rail. Chain Signatures let a NEAR account sign on another chain, and this thesis does not count that rail.

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

The exact-scheme spec is merged and the facilitators are named, yet they settled {{n:near.known.named_delegate}} exact-scheme payments in those 30 days. That gap is the strongest evidence that the exact scheme has not lit. The argument, the evidence, and the number that would change my mind are in the sections below. Every figure about the market and about vet402 below comes from this repository, either from one script you can rerun without a key or an account, or from a quote in the table at the end. The BigQuery upper bound is the exception: it needs a Google Cloud account, and the result is frozen in `data/snapshot/near/bigquery-n-upper-bound.json`.

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. It rewrites `data/thesis.json` and `docs/thesis.json`; only `generated_at` changes. NEAR from that same frozen snapshot, with no network: the settlement spec is present ({{n:near.spec.settlement_sentence}}), the opt-in catalog lists {{n:near.facilitator.discovery_total}} resources, the named relayer has {{n:near.relayer.payments}} payments, and N's line is {{n:threshold.line}}. The known relay accounts sum to {{n:near.known.lower}}, a lower bound on N and {{n:near.known.lower_share_of_line}} of the line. The upper bound on N is {{n:near.bq.n_upper_bound}}, below the line (section 6). The biased sample estimate is in the appendix and is not used in the claim. Stdout is one line and ends with `N ≤ {{n:near.bq.n_upper_bound}} < {{n:threshold.line}}: the threshold is not crossed (BigQuery bound, frozen)`. While `relay-census.json` is absent, the line adds `relay census not fetched`. |
| `node online/fetch-intents-sample.mjs --offline` | Reprints the frozen intents.near index sample with no network: {{n:near.intents.sample_rows}} rows in the {{n:near.intents.points}}-day sample, payment-scale settlements: {{n:near.intents.payment_count}} ({{range:near.intents.sample_rows}}), blocks {{field:near.intents_sample.height_min}} to {{field:near.intents_sample.height_max}}. Days not fetched: {{field:near.intents_sample.unavailable_label}}. |
| `node thesis.mjs --fetch-relays` | The known relay accounts over 30 days, through the FastNEAR transaction API (`POST /v0/account` and `POST /v0/transactions`). It writes `data/snapshot/near/facilitators.json` and reuses the Delegate match from the relayer census. It does not page NearBlocks. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. The script builds [README.md](README.md) again from `README.tmpl.md` and `data/thesis.json` and compares it line by line, so an edited figure in README.md shows up as a mismatch. Figures typed into the template itself are not covered by this check. The quotes cover them. |
| `node thesis.mjs --check-quotes` | `missing: 0`. Each quote below is fetched again and found word for word. Web pages are read directly, X posts through the public fxtwitter API, and the one PDF is reported as not machine-checked. |
| `node --test` | All tests pass with no network, including one that stops on an unknown purchase status and one that rebuilds from the frozen snapshot in a throwaway copy and compares it with the committed `data/thesis.json`. |
| `node --test online/fetch-compare.mjs` | Needs the network. A throwaway copy fetches the public sources, then `--offline` rebuilds, and the two sets of numbers match. This file sits outside `test/`, so `npm test` does not run it. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard. The same numbers, each with its range, date and source, and a count of any figure missing one of them. |

The vet402 export behind this page has sha256 `{{snapshot.sha256}}` and was retrieved {{snapshot.retrieved_at}}. The derived copy in this repository, `data/snapshot/export.derived.csv`, has sha256 `{{snapshot.derived_sha256}}`.

## Terms

{{definitions.table}}

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements and say nothing about demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

x402scan lists Base, Solana, Polygon and Optimism. Polygon and Optimism show zero in the latest 30 days, so the total below is Base plus Solana: {{n:x402.total.amount_30d}} of x402 payments (retrieved {{asof:x402.total.amount_30d}} UTC). Base carried {{n:x402.base.share_amount_30d}} of the dollars and {{n:x402.base.share_count_30d}} of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`). The report calls the figures in its section 1 raw onchain totals and gives adjusted figures without wash and test transactions elsewhere. Section 3.3 does not say which kind it uses. Nothing here is adjusted.

The word settlement is used for two different records. NEAR Intents settles a payment by moving value across chains, through its solver network. x402 settlement on NEAR is a USDC transfer that is a delegate action on NEAR itself. x402scan's chain filter accepts only those four chains (its answer to a NEAR filter is saved in `data/snapshot/x402scan/near-rejected.json`), so x402scan cannot count the second one. The count this thesis uses for that second one is N, defined in [section 6](#6-what-would-change-my-mind): delegate-action USDC `ft_transfer`s on NEAR in 30 days. The line is N ≥ {{n:threshold.line}}. The upper bound on N is {{n:near.bq.n_upper_bound}}, below the line (section 6). As of 2026-10-29, Base is where x402scan can see agent payments settle. That is not a measurement of N.

## 2. A payment and a delivered answer are two different records

vet402 tried to buy from x402 sellers {{range:vet402.attempts}}. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled. For {{n:vet402.settled_no_tx}} of those, all on Arc mainnet (eip155:5042), the export has no transaction hash. For {{n:vet402.settled_seller_claim}} of the settled purchases, the export records the seller's claim as the evidence of settlement. The rechecks below cover samples of those on Base and Solana. Of the settled purchases, {{n:vet402.delivered}} came back with an HTTP 2xx answer ({{n:vet402.delivered_share}}).

{{n:vet402.held}} settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out of its own rates. Of the {{n:vet402.settled_not_held}} settled purchases left, {{n:vet402.unexplained}} ({{n:vet402.unexplained_share_excl_held}}) paid and got no usable answer, with no explanation in the record.

Every row lands in exactly one group. An unknown status stops the script instead of falling into "other".

{{breakdown.table}}

I rechecked {{n:recheck.base.checked}} Base and {{n:recheck.solana.checked}} Solana settlements from this export against public RPCs. On Base, {{n:recheck.base.match}} receipts succeeded and carry a USDC transfer of exactly the purchase amount. On Solana, {{n:recheck.solana.match}} transactions succeeded and credit one USDC account with exactly that amount. The recheck does not compare the payee with the seller, because the export does not list the payee. Other chains are not rechecked.

vet402 records whether each answer arrived for its own purchases, and the gap above is what that record shows.

## 3. NEAR already moves money around payments

NEAR Intents moved {{n:intents.volume_30d|M}} in its latest 30 days on DefiLlama (retrieved {{asof:intents.volume_30d}} UTC).

NEAR Intents lists `0x2CfF890f0378a11913B6129B2E97417a2c302680` as its treasury address on EVM chains, Base included (quote `near_intents.treasury`). On Base, over {{range:vault.usdc_out_30d.usd}}, that address sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers. The transfers carry no label, so this counts every purpose, and the data here cannot say how much of it, if any, is x402. For scale only, it is about {{n:compare.vault_over_x402_base_30d}} times the x402 dollars on Base over a similar 30 days.

NEAR Foundation names the same layer (quote `near_blog.around_payment`). Its stated intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. This section is the cross-chain settlement, the movement through Intents. It is not a count of x402 settlement on NEAR. The same post also names settlement on NEAR Protocol, covered in section 5.

## 4. The model

In the 30-day windows read on 2026-10-29, x402 was {{model.ratio}} of NEAR Intents volume. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

0.040% = 1,579,185 / 3,965,443,376.

Each cell is a yearly amount, the 30-day x402 figure times 12, that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is {{model.fee_rate}}, cumulative fees over cumulative volume, and NEAR keeps its reported lifetime share of those fees, {{model.input.take_rate}} (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The same report gives a trailing 30-day share of {{model.input.take_rate_trailing_30d}} (quote `near_q3.capture_30d`). Using it would raise every cell by about {{model.input.trailing_over_lifetime}} times. NEAR reports {{model.input.q3_intents_usd}} for Q3 (quote `near_q3.q3_volume`). DefiLlama's daily sum for the same quarter is {{model.q3_gap}} lower. The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

{{model.table}}

The largest cell is a yearly figure. For comparison, NEAR captured over {{model.input.buyback_usd}} for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). The largest cell stays below that buyback figure.

Dividing that {{model.input.buyback_usd}} floor by the 1× cell of each column gives {{model.buyback_multiple.pass_50pct}}× at 50% pass-through, {{model.buyback_multiple.pass_10pct}}× at 10%, and {{model.buyback_multiple.pass_1pct}}× at 1%, rounded to the nearest whole number. The floor is the seven-month capture in those quotes, and each cell is a yearly amount, so the multiple is how many times the 30-day x402 figure in that column must grow before the yearly amount equals the floor.

The printed rows stop at 1,000×. The largest cell is {{model.largest_cell}} at 1,000× and 50% pass-through, and it stays under that floor.

My own investment horizon is one year, to 2027-11. That horizon is my choice and is not part of the pre-registered rule, which has no end date. By then, a reader can check whether N has reached {{n:threshold.line}} and whether the 30-day x402 dollars and the share through Intents have moved one of these cells onto the floor. Those indicators are in section 7.

My opinion, which this data does not test: funding, and a record of what arrived, are the part I claim for NEAR. Cross-chain settlement through NEAR Intents is already that funding layer. x402 settlement on NEAR, the delegate-action count N, is a different question, and this model does not answer it.

## 5. Arguments against

x402 settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). That sentence is about a transfer settling on NEAR, not about Intents moving value across chains. The number that would make that path the claim is N ≥ {{n:threshold.line}}, where N is the 30-day count of delegate-action USDC transfers defined in [section 6](#6-what-would-change-my-mind). The known relay accounts sum to {{n:near.known.lower}} {{range:near.known.lower}}. That sum is a lower bound on N, {{n:near.known.lower_share_of_line}} of the line. `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c` is not named by any facilitator `/supported` response. It is a generic relay. Its {{n:near.known.generic_delegate}} delegate-action USDC transfers are not known to be x402. They are counted only as a lower bound on N. The upper bound on N is {{n:near.bq.n_upper_bound}}, below the line (section 6). `uvd-facilitator.near` signed {{n:near.known.uvd_signer_txs}} transactions in the census window: {{n:near.known.uvd_ft_transfer_call}} Delegate `ft_transfer_call` to NEAR USDC and {{n:near.known.uvd_escrow_calls}} calls on `v1.arras-escrow.near` ({{n:near.known.uvd_withdraw_for}} `withdraw_for`, {{n:near.known.uvd_release}} `release`, {{n:near.known.uvd_refund}} `refund`). Those may be an escrow scheme of x402. This page does not classify them as x402 or as not x402. Its exact-scheme Delegate USDC `ft_transfer` count is {{n:near.known.uvd_delegate}}. The biased sample estimate is in the appendix. It is not used in the claim. Base at {{n:x402.base.share_amount_30d}} of x402 dollars is where x402scan can see volume. It does not measure N. The count is stored in `data/snapshot/near/bigquery-n-upper-bound.json`. `sql/n-upper-bound.sql` is the whole-date count, and that count is the upper bound. `sql/n-upper-bound-daily.sql` cuts the window by timestamp and prints one row per day.

## 6. What would change my mind

The condition is the one below. I will drop the claim that x402 settlement on NEAR is specified but not yet in use, and say that x402 settlement on NEAR is itself a place where NEAR earns, if this holds:

N counts a NEAR transaction only when all of these are true. It carries a `Delegate` action. The delegate's `receiver_id` is the NEAR USDC contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`. That action holds exactly one `ft_transfer`. The inner transfer succeeded. The block time falls in the 30 days that end at the fetch. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound, tilted against the claim. N bounds exact-scheme x402 only; escrow-scheme calls such as uvd-facilitator.near's are outside N. A higher N can only make me change my mind sooner.

The line is the next whole number above 1% of the Base count frozen on 2026-10-30, in `data/snapshot/x402scan/base.json`. A later NEAR fetch cannot move it. The reading rule for a partial count is in [How the result is read](#how-the-result-is-read).

The measured upper bound is {{n:near.bq.n_upper_bound}} (retrieved {{field:near.bq.retrieved_at}} UTC). The dates 2026-10-08 through 2026-11-07 contain the census window, and the inner receipt is not required to succeed, so N ≤ {{n:near.bq.n_upper_bound}} < {{n:threshold.line}}. N < {{n:threshold.line}}, all 30 days counted: the threshold is not crossed. The claim stands. The minute-cut window count is {{n:near.bq.minute_window}}. PREREG.md named free sources that need no key. Keyless, I reached only the known-relay sum, {{n:near.known.lower}}, which covers the named accounts and not every account. The posted rule reads that partial count as not decided. This upper bound is BigQuery public data, and that query needs a Google Cloud account on the free tier. The result is frozen in `data/snapshot/near/bigquery-n-upper-bound.json`.

## 7. What I watch

| Indicator | Where it comes from in this repository |
|---|---|
| x402 dollars and payments by chain, 30 days | `lib/sources/x402scan.mjs` |
| NEAR Intents volume, 30 days and all time | `lib/sources/defillama.mjs` |
| USDC sent out of the NEAR Intents treasury on Base | `lib/sources/vault.mjs` (`--fetch-vault`) |
| Settled and delivered purchases in vet402's sample | `lib/classify.mjs` on the vet402 export |
| N, delegate-action USDC transfers on NEAR, 30 days | `data/snapshot/near/facilitators.json`, via `lib/sources/fastnear-census.mjs` (`node thesis.mjs --fetch-relays`). The full walk in `lib/sources/relay-census.mjs` is not frozen. |
| Upper bound on N | `data/snapshot/near/bigquery-n-upper-bound.json`, from `sql/n-upper-bound.sql`. The whole dates 2026-10-08 through 2026-11-07 contain the census window. The inner receipt is not required to succeed, so the count is at least N. |

As of 2026-10-30, x402scan does not list NEAR. N is the count used here for x402 settlement on NEAR, and it includes delegate-action USDC transfers that are not x402. If x402scan starts listing NEAR, that row belongs here too.

The windows do not line up to the hour. DefiLlama counts whole days, x402scan runs to its latest block, and the treasury count uses the block range above.

The frozen sample took {{n:near.delegate.sampled_receipts}} USDC `ft_transfer` receipts at 30 points, 15 at each point, and found {{n:near.delegate.sample_hits}} of the delegate shape. All {{n:near.delegate.sample_hits}} are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That signer's complete 30-day delegate-action count is {{n:near.known.generic_delegate}}. The sample share is about {{n:near.delegate.sample_over_signer}} times that signer's share of {{n:near.delegate.transfers_30d}} USDC transfer events of every shape, so the sample over-represents that signer. All 30 sample points fall at 16:24 UTC. Scaling the sample share by those events gives {{n:near.delegate.estimate}}, rounded to the nearest transfer. The one-sided 95% upper bound, assuming independent draws (the sample is 30 clusters of 15 receipts, so this is optimistic), is {{n:near.delegate.estimate_upper_95}}. Neither number is N.

## Quotes

Each quote is a full sentence with its link and one line of context. Quotes that argue against this thesis are in the same table. `node thesis.mjs --check-quotes` fetches each source again.

{{quotes.table}}

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

vet402 is a product I run, and a finding that delivery records matter would help it.

This is not investment advice.

## About this repository

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in https://nearhackathon.com/HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. The vet402 export starts on 2026-08-14 and is baseline data from before the window. The classification, the checks, the model, the dashboard and this thesis were written in the window. The first commit is dated 2026-10-30 (JST).

The export comes from https://vet402.com/api/v1/observatory/export.csv?days=365 under CC BY 4.0, and its sha256 is given in the paragraph after the [Try it](#try-it) table. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`). No third-party packages are used. The code was written with AI coding agents (Claude and Grok), then run and checked by me.

