# Thesis

The four sections follow the NEAR HACKATHON thesis track. The threshold in "What would change my mind" was committed on its own, before any NEAR data was fetched for this version, in commit f0c48d1. `git log -- THESIS.md` shows that section came first. The same commit and the SHA-256 of that THESIS.md (d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec) were posted on NEAR at 2026-11-07 10:13 UTC, before the full relayer count ran: https://near.social/smartbread5934.near/post/1794046390265

## Claim

NEAR's edge in agent payments is the funding and settlement layer: NEAR Intents already settles cross-chain agent payments, and x402 has had a NEAR settlement spec since {{field:near.spec.pr_merged_at}} UTC that is ready but not yet lit.

### Impact

The people this reaches are agents that pay through x402, and the accounts that fund them. x402scan counted {{n:threshold.base_count_30d}} payments on Base over 30 days. The Intents treasury on Base sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers. Those transfers have no label, so they are not an x402 count. The 30-day count of delegate-action USDC transfers on NEAR is not in the snapshot yet. Until `data/snapshot/near/relay-census.json` is frozen, I do not claim that x402 settlement on NEAR is a flow at the size of the line below.

### Sustainability

Every figure here rebuilds from the frozen snapshot with `node thesis.mjs --offline`, with no key and no account. The line was fixed in commit f0c48d1 before the NEAR fetch, so a later refetch cannot move it. `node thesis.mjs --fetch-relays` walks the relayers it can see, waits out HTTP 429 by widening the gap, and resumes from `data/snapshot/near/relay-census.progress.json`. The upkeep is to run the same script on the next 30-day window. Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of {{n:threshold.line}}.

## Evidence for

The NEAR exact scheme is in the canonical repository x402-foundation/x402, file `specs/schemes/exact/scheme_exact_near.md`, merged in PR {{field:near.spec.pr_number}} at {{field:near.spec.pr_merged_at}} UTC. The frozen copy contains the sentence that outer-transaction success is not sufficient. On this page that fact is {{n:near.spec.settlement_sentence}}, where 1 means the sentence is present. Source: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_near.md

That sentence is the same shape one layer up. The spec says a successful outer transaction does not mean the inner transfer succeeded. vet402's record says a settled payment does not mean the answer was delivered. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled, and {{n:vet402.delivered}} of the settled purchases came back with an HTTP 2xx answer. A payment and a delivered answer are two records.

NEAR Intents settles cross-chain payments through its solver network. The frozen page is https://mpp.dev/payment-methods/nearintents. The client library named there is `@defuse-protocol/nearintents-mpp-sdk`. The snapshot has the page and no payment count, so I do not state one.

The public facilitator at x402.mikedotexe.com reports scheme `exact` on `near:mainnet` and names `x402-relayer2.mike.near` as a signer. NEAR Intents volume was {{n:intents.volume_30d|M}} {{range:intents.volume_30d}} UTC (retrieved {{asof:intents.volume_30d}} UTC). That window is not the window used for N ({{range:near.delegate.sampled_receipts}} UTC). On Base, the Intents treasury address sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers over {{range:vault.usdc_out_30d.usd}}. This is the funding and movement layer. Nothing in those transfers says which of them, if any, are x402.

## Evidence against

The opt-in discovery catalog at x402.mikedotexe.com lists {{n:near.facilitator.discovery_total}} resources. Sellers add themselves to that list. Zero there means zero listings, not zero sellers.

The one named relayer, `x402-relayer2.mike.near`, has {{n:near.relayer.payments}} delegate payments in the frozen receipt list. The smallest is {{n:near.relayer.payment_usdc_min}} USDC and the largest is {{n:near.relayer.payment_usdc_max}} USDC. They go from {{field:near.relayer.payment_senders}} to {{field:near.relayer.payment_receivers}}, and the last one is {{field:near.relayer.payment_last_at}} UTC. These are the operator's own accounts. They sit before the 30-day window used for N, so they are not that count. They are the payments I can point at today.

N, the 30-day count of delegate-action USDC `ft_transfer`s, is not frozen yet. The frozen sample took {{n:near.delegate.sampled_receipts}} USDC `ft_transfer` receipts at 30 points, 15 at each point, and found {{n:near.delegate.sample_hits}} of the delegate shape. All {{n:near.delegate.sample_hits}} of those hits are signed by the same relayer account `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. Counting that account's 30 days decides N (`node thesis.mjs --fetch-relays`). Scaling that share by {{n:near.delegate.transfers_30d}} USDC transfer events of every shape gives an estimate of {{n:near.delegate.estimate}}, rounded to the nearest transfer. The one-sided 95% upper bound, assuming independent draws (the sample is 30 clusters of 15 receipts, so this is optimistic), is {{n:near.delegate.estimate_upper_95}}. The line is {{n:threshold.line}}. The upper bound is above the line and the point estimate is below it, so the result is not decided. N includes transfers that are not x402, so the count is tilted against the claim.

The estimate is biased. All 30 sample points fall at 16:24 UTC, because the window opened at 04:24 and each point is one day plus half a day later. That minute weighs more than it would across a day. The upper bound is kept, with that bias. It is not a count. The {{n:near.delegate.transfers_30d}} figure counts every transfer shape, so it is larger than N and is not N. Relayers the sample missed are absent from any lower bound this page can print today.

`escrow.ai.near` signed {{n:near.escrow.txs}} `execute_intents` transactions in one short sample, {{range:near.escrow.txs}} UTC. After removing retries, {{n:near.escrow.unique_intents}} intents remain: {{n:near.escrow.intents_success}} succeeded, {{n:near.escrow.intents_invalid_intent}} were invalid, {{n:near.escrow.intents_insufficient_balance}} lacked balance, and {{n:near.escrow.intents_other}} failed for another reason. That this account is the NEAR AI Agent Market escrow is an estimate. The sample is not 30 days, and it is not a pillar of the claim.

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

This is the exact shape the x402 NEAR scheme requires (x402-foundation/x402, `specs/schemes/exact/scheme_exact_near.md`, section "Delegated Action Safety": one action, `ft_transfer`, `receiver_id` equal to the asset). Every x402 payment in NEAR USDC is in N. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound. A higher N can only make me change my mind sooner.

N is counted with free sources that need no key: the NearBlocks public API and NEAR public RPC (`node thesis.mjs --fetch-relays`). Each transaction is counted once. `data/snapshot/near/relay-census.json` is not frozen, so the sample estimate above is not N. The five sample hits share one signer, so counting that account's 30 days closes this.

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

The lower bound, the payments through the one known x402 facilitator relayer, is reported next to N. It does not change the rule. While the census file is absent, `--offline` prints `full count not yet fetched` and does not treat the estimate as a result.
