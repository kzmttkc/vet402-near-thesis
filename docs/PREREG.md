# Thesis

The four sections follow the NEAR HACKATHON thesis track. Claim, Evidence for and Evidence against are written after the data. The threshold below was written first and committed on its own, before any NEAR data was fetched for this version, so `git log -- THESIS.md` shows it came first.

## Claim

(Written after the data.)

## Evidence for

(Written after the data.)

## Evidence against

(Written after the data.)

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

This is the exact shape the x402 NEAR scheme requires (x402-foundation/x402, `specs/schemes/exact/scheme_exact_near.md`, section "Delegated Action Safety": one action, `ft_transfer`, `receiver_id` equal to the asset). Every x402 payment in NEAR USDC is in N. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound. A higher N can only make me change my mind sooner.

N is counted with free sources that need no key: the NearBlocks public API and NEAR public RPC (`node thesis.mjs --fetch-near`). Each transaction is counted once.

### The Base count, frozen before this threshold

The Base count is x402scan `total_transactions` for `chain: base`, `timeframe: 30`, read from the file already in this repository:

- File: `data/snapshot/x402scan/base.json`, sha256 `9bc61df7abfbbb3f96b511503ce2d52481118b4b34cbdbc414afc4c1671fa55e`
- Window: 30 days to `2026-10-29T22:45:39Z` (`latest_block_timestamp`), retrieved `2026-10-29T23:18:32Z`
- Value: 2,539,947 payments. 1% is 25,399.47, so the line is **25,400**.

This number does not change when the NEAR data is fetched again. The windows do not match by date (Base to 10/29, NEAR to the day of the fetch), and that gap is accepted as part of the rule.

### How the result is read

- **N ≥ 25,400**: the threshold is crossed. I change my mind as stated above.
- **N < 25,400, all 30 days counted**: the threshold is not crossed. The claim stands.
- **Only part of the 30 days could be counted without a key**: the snapshot states the range counted and why the count stopped. If the partial count is already at least 25,400, the threshold is crossed, because a partial count is never larger than the full one. If it is below 25,400, the result is "not decided", and I do not report it as a pass.

The lower bound, the payments through the one known x402 facilitator relayer, is reported next to N. It does not change the rule.
