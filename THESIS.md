# Thesis

The four sections follow the NEAR HACKATHON thesis track. The threshold in "What would change my mind" was committed on its own, before the full count (N) was seen, in commit f0c48d1. The on-chain post (block 223452268, 2026-11-07 10:13 UTC) is the timestamp a third party can check. At publication, the executive tags commit f0c48d1 `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the posted digest. The same commit and the SHA-256 of that THESIS.md (d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec) were posted on NEAR at 2026-11-07 10:13 UTC, before the full relayer count ran: https://near.social/smartbread5934.near/post/1794046390265. The check, and the words that changed after the post, are in [PREREG-VERIFY.md](PREREG-VERIFY.md).

## Claim

NEAR's edge in agent payments is the funding and settlement layer: NEAR Intents already settles cross-chain agent payments, and x402 has had a NEAR settlement spec since 2026-05-16 14:01 UTC that is ready but not yet lit.

The known x402 facilitators, `x402-relayer2.mike.near`, `x402-relayer.mike.near`, `solvador.near`, and `uvd-facilitator.near`, settled 0 exact-scheme payments from 2026-10-08 11:42 to 2026-11-07 11:42 UTC.

`uvd-facilitator.near` signed 51 transactions in that window: 14 Delegate `ft_transfer_call` to NEAR USDC and 37 calls on `v1.arras-escrow.near` (24 `withdraw_for`, 11 `release`, 2 `refund`). Those may be an escrow scheme of x402. This page does not classify them as x402 or as not x402. Its exact-scheme Delegate USDC `ft_transfer` count is 0.

The exact-scheme spec is merged and the facilitators are named, yet they settled 0 exact-scheme payments in those 30 days. That gap is the strongest evidence that the exact scheme has not lit.

### Impact

The people this reaches are agents that pay through x402, and the accounts that fund them. x402scan counted 2,539,947 payments on Base over 30 days. The Intents treasury on Base sent out $41.05M of USDC in 45,840 transfers. Those transfers have no label, so they are not an x402 count. The full 30-day count of delegate-action USDC transfers on NEAR is not frozen. The known relay accounts sum to 1,716. That sum is a lower bound on N, and it is 6.8% of the line. All of that sum comes from `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`, a generic relay not named by `/supported`, and those transfers are not known to be x402. Unknown relay accounts would raise N. The evidence in hand sits below the line. The upper bound on all of N cannot be measured without a key, so the reading is not decided.

### Sustainability

Every figure here rebuilds from the frozen snapshot with `node thesis.mjs --offline`, with no key and no account. The line was fixed in commit f0c48d1 from the Base count frozen on 2026-10-30, so a later NEAR fetch cannot move it. The timing of the post is in [PREREG-VERIFY.md](PREREG-VERIFY.md). `node thesis.mjs --fetch-relays` counts the known relay accounts through the FastNEAR transaction API and writes `data/snapshot/near/facilitators.json`. It does not page every USDC transfer. The upkeep is to run the same script on the next 30-day window. Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of 25,400.

## Evidence for

The NEAR exact scheme is in the canonical repository x402-foundation/x402, file `specs/schemes/exact/scheme_exact_near.md`, merged in PR 1459 at 2026-05-16 14:01 UTC. The frozen copy contains the sentence that outer-transaction success is not sufficient. On this page that fact is 1, where 1 means the sentence is present. Source: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_near.md

That sentence is the same shape one layer up. The spec says a successful outer transaction does not mean the inner transfer succeeded. vet402's record says a settled payment does not mean the answer was delivered. Of 18,683 attempts, 12,223 settled, and 11,189 of the settled purchases came back with an HTTP 2xx answer. A payment and a delivered answer are two records.

NEAR Intents settles cross-chain payments through its solver network. The frozen page is https://mpp.dev/payment-methods/nearintents. The client library named there is `@defuse-protocol/nearintents-mpp-sdk`. The snapshot has the page and no payment count. Of 30 intents.near index rows from 2026-11-07 16:18 to 2026-11-07 16:20 UTC, blocks 223490307 to 223490446, 1 is a payment-scale settlement, not the delegate-action count N.

The public facilitator at x402.mikedotexe.com reports scheme `exact` on `near:mainnet` and names `x402-relayer2.mike.near` as a signer. NEAR Intents volume was $3.97B from 2026-09-29 00:00 to 2026-10-28 00:00 UTC (retrieved 2026-10-29 23:18 UTC). That window is not the window of the N lower bound (from 2026-10-08 11:42 to 2026-11-07 11:42 UTC) or of the sample (from 2026-10-08 04:24 to 2026-11-07 04:24 UTC). On Base, the Intents treasury address sent out $41.05M of USDC in 45,840 transfers over blocks 51965969 to 53261969. This is the funding and movement layer. Nothing in those transfers says which of them, if any, are x402.

## Evidence against

The opt-in discovery catalog at x402.mikedotexe.com lists 0 resources. Sellers add themselves to that list. Zero there means zero listings, not zero sellers.

The one named relayer, `x402-relayer2.mike.near`, has 6 delegate payments in the frozen receipt list. The smallest is 0.001 USDC and the largest is 0.001 USDC. They go from mike.near to count.mike.near, and the last one is 2026-07-30 15:47 UTC. These are the operator's own accounts. They sit before the 30-day window used for N, so they are not that count. As of 2026-11-07, they are the only payments through that relayer I can point at.

N, the 30-day count of delegate-action USDC `ft_transfer`s, is not fully counted. The known relay accounts sum to 1,716 from 2026-10-08 11:42 to 2026-11-07 11:42 UTC. That sum is the complete 30-day count for the accounts this survey named, and it is a lower bound on N. All 5 delegate-shaped hits in the frozen sample are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That account is not named by any facilitator `/supported` response. It is a generic relay. Its 1,716 delegate-action USDC `ft_transfer`s are not known to be x402. They are the whole of this lower bound. The line is 25,400. 1,716 is 6.8% of that line. Unknown relay accounts would raise N. The evidence in hand sits below the line. The upper bound on all of N cannot be measured without a key, so the reading is not decided. N includes transfers that are not x402, so the count is tilted against the claim. The biased sample estimate is in the appendix. It is not used in the claim.

`escrow.ai.near` signed 100 `execute_intents` transactions in one short sample, from 2026-11-07 05:13 to 2026-11-07 05:21 UTC. After removing retries, 15 intents remain: 0 succeeded, 10 were invalid, 4 lacked balance, and 1 failed for another reason. That this account is the NEAR AI Agent Market escrow is an estimate. The sample is not 30 days, and it is not a pillar of the claim.

## What would change my mind

**Threshold committed before data.**

My claim is that NEAR's edge in agent payments is the funding and settlement layer (NEAR Intents), and that x402 settlement on NEAR itself is specified but not yet in use. I will drop the second half and say "x402 settlement is itself a place where NEAR earns" if this holds:

> **N ≥ 25,400**, where N is the number of NEAR delegate-action USDC transfers in a 30-day window, and 25,400 is 1% of the x402 payments counted on Base over 30 days.

### N, the NEAR count (an upper bound on x402 on NEAR)

N counts NEAR transactions in which all of these are true:

1. The transaction carries a `Delegate` action (NEP-366 meta-transaction, `DELEGATE_ACTION` in NearBlocks).
2. The delegate action's `receiver_id` is the NEAR USDC contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`.
3. The delegate action holds exactly one action, a `FunctionCall` to `ft_transfer`.
4. The inner `ft_transfer` receipt succeeded.
5. The transaction's block time falls in the 30 days that end at the moment of the fetch.

This is the exact shape the x402 NEAR scheme requires (x402-foundation/x402, `specs/schemes/exact/scheme_exact_near.md`, section "Delegated Action Safety": one action, `ft_transfer`, `receiver_id` equal to the asset). Every x402 payment in NEAR USDC is in N. This holds for the exact scheme. Escrow-scheme calls such as uvd-facilitator.near's are outside N. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound. A higher N can only make me change my mind sooner.

The known-account sum is in `data/snapshot/near/facilitators.json` (sha256 `4455a689a039f8b47af39c6a00c60ecc1e36c00b71fc5c971c876173e0acbeb9`), counted with the FastNEAR transaction API (`node thesis.mjs --fetch-relays`). Each opened transaction is counted once. `data/snapshot/near/relay-census.json` is not frozen, so that sum is not all of N. The five sample hits share one signer. That signer's 30 days are inside the sum, and other signers can still exist.

### The Base count, frozen before this threshold

The Base count is x402scan `total_transactions` for `chain: base`, `timeframe: 30`, read from the file already in this repository:

- File: `data/snapshot/x402scan/base.json`, sha256 `9bc61df7abfbbb3f96b511503ce2d52481118b4b34cbdbc414afc4c1671fa55e`
- Window: 30 days to `2026-10-29T22:45:39Z` (`latest_block_timestamp`), retrieved `2026-10-29T23:18:32Z`
- Value: 2,539,947 payments. The line is the next whole number above 1% of that count, **25,400**.

This number does not change when the NEAR data is fetched again. The windows do not match by date (Base to 10/29, NEAR to the day of the fetch), and that gap is accepted as part of the rule.

### How the result is read

- **N ≥ 25,400**: the threshold is crossed. I change my mind as stated above.
- **N < 25,400, all 30 days counted**: the threshold is not crossed. The claim stands.
- **Only part of the 30 days could be counted without a key**: the snapshot states the range counted and why the count stopped. If the partial count is already at least 25,400, the threshold is crossed, because a partial count is never larger than the full one. If it is below 25,400, the result is "not decided", and I do not report it as a pass.

The lower bound is the sum of the known relay accounts, 1,716. That is 6.8% of the line. Unknown relay accounts would raise N. The evidence in hand sits below the line. The upper bound on all of N cannot be measured without a key, so the reading of this partial sum is not decided. It does not change the rule. The line stays 25,400. While `relay-census.json` is absent, `--offline` prints `full count not yet fetched` and does not treat the sample estimate as a result.

## Appendix: biased sample estimate

This estimate is a reference. It is not used in the claim.

The frozen sample took 450 USDC `ft_transfer` receipts at 30 points, 15 at each point, and found 5 of the delegate shape. All 5 are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That signer's complete 30-day delegate-action count is 1,716. The sample share is about 12 times that signer's share of 1,837,873 USDC transfer events of every shape, so the sample over-represents that signer. All 30 sample points fall at 16:24 UTC, because the window opened at 04:24, the first point is half a day after that, and each later point is one day after the one before. Scaling the sample share by those events gives 20,421, rounded to the nearest transfer. The one-sided 95% upper bound, assuming independent draws (the sample is 30 clusters of 15 receipts, so this is optimistic), is 42,675. Neither number is N. The 1,837,873 figure counts every transfer shape, so it is larger than N and is not N.
