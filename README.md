# NEAR in agent payments: a thesis you can rerun

The claim stands: over the 30 days of the census window, N, the count of delegate-action USDC transfers on NEAR, is at most 2,532. That figure counts the 31 whole dates that contain the window, and it is below the threshold of 25,400 that was posted on chain at 2026-11-07 10:13 UTC, before the count. The dashboard is published at https://kzmttkc.github.io/vet402-near-thesis/. A two-minute walkthrough video is at https://youtu.be/FH0V72KDRiw.

NEAR's edge in agent payments is the funding and settlement layer. NEAR Intents volume was $3.97B from 2026-09-29 00:00 to 2026-10-29 00:00 UTC (retrieved 2026-10-29 23:18 UTC). Source: DefiLlama totalDataChart, 2026-09-29 to 2026-10-29 UTC. That volume is not a count of agent payments. x402 has had a NEAR settlement spec since 2026-05-16 14:01 UTC. The known x402 facilitators, `x402-relayer2.mike.near`, `x402-relayer.mike.near`, `solvador.near`, and `uvd-facilitator.near`, settled 0 exact-scheme payments from 2026-10-08 11:42 to 2026-11-07 11:42 UTC.

## Where this stands (2026-11-07)

- As of 2026-10-30, x402scan cannot count x402 settlement on NEAR. The upper bound on N is 2,532, below the line (section 6). The named facilitators settled 0 exact-scheme payments from 2026-10-08 11:42 to 2026-11-07 11:42 UTC. NEAR Intents volume in the snapshot is $3.97B from 2026-09-29 00:00 to 2026-10-29 00:00 UTC. The x402 NEAR settlement spec is present.
- The threshold is N ≥ 25,400, committed in f0c48d1. The line is 1% of the Base x402 count frozen on 2026-10-30, so it does not depend on NEAR data. The check is in [PREREG-VERIFY.md](PREREG-VERIFY.md).
- [THESIS.md](THESIS.md) holds the claim, the evidence, and that threshold.

This is an entry for the NEAR HACKATHON track "Investment Thesis", which is judged on the evidence.

## The pre-registered line

The history of this branch contains commit `f0c48d13ed5af6147daa0e7a0b444855f3186770` (`f0c48d1`), so a third party can see the line as it was committed. Commit `f0c48d1` is tagged `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the digest posted on NEAR (see [PREREG-VERIFY.md](PREREG-VERIFY.md)).

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. It rewrites `data/thesis.json` and `docs/thesis.json`; only `generated_at` changes. NEAR from that same frozen snapshot, with no network: the settlement spec is present (1), the opt-in catalog lists 0 resources, the named relayer has 6 payments, and N's line is 25,400. The known relay accounts sum to 1,716, a lower bound on N and 6.8% of the line. The upper bound on N is 2,532, below the line (section 6). The biased sample estimate is in the appendix and is not used in the claim. Stdout is one line and ends with `N ≤ 2,532 < 25,400: the threshold is not crossed (BigQuery bound, frozen)`. While `relay-census.json` is absent, the line adds `relay census not fetched`. |

## What NEAR can use from this repository

Three pieces in this repository are a next step. None of them sends a mainnet transaction.

A reviewer uses [PREREG-VERIFY.md](PREREG-VERIFY.md). `git show prereg-threshold:THESIS.md | shasum -a 256` prints the posted digest, and a public RPC read of `BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB` shows the same commit and digest in the transaction arguments.

A facilitator operator uses `facilitator/`, a reference facilitator for the NEAR exact scheme, plus a delivery receipt at `POST /receipt`. The chain is an in-process mock of JSON-RPC on `127.0.0.1`. The signed delegate is canonical JSON, not the Borsh `SignedDelegateAction` a production facilitator verifies.

```
node --test test/22-facilitator.test.mjs
```

Expected: `✔ mock NEAR RPC, not a sandbox: buyer payment, facilitator settle, seller receipt` and `ℹ fail 0`.

A spec reader uses `spec/delivery-proof.md`, a proposal that adds a delivery proof on top of NEAR exact. It does not change that scheme's settlement rules.

```
node --test test/21-delivery-proof.test.mjs
```

Expected: `✔ frozen vectors: valid receipt, tampered body, reused payment, forged signature` and `ℹ fail 0`.
