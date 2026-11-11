# x402scan can't count x402 payments on NEAR. So I posted a line on chain (25,400) before counting: at most 2,532.

N ≤ 2,532 < 25,400 ([section 6](THESIS.md#6-what-would-change-my-mind)). N is the count of delegate `ft_transfer`s of NEAR USDC. Rebuilt from the frozen copy.

NEAR's edge in agent payments is the funding and settlement layer. NEAR Intents volume was $3.97B over 30 days. DefiLlama totalDataChart, 2026-09-29 to 2026-10-29 UTC. That volume is not a count of agent payments. The dashboard is published at https://kzmttkc.github.io/vet402-near-thesis/. A two-minute walkthrough video is at https://youtu.be/FH0V72KDRiw.

## Where this stands (2026-11-07)

- As of 2026-10-30, x402scan cannot count x402 settlement on NEAR. The named facilitators settled 0 exact-scheme payments from 2026-10-08 11:42 to 2026-11-07 11:42 UTC. That window is not the Intents window above.
- The known relay accounts sum to 1,716, a lower bound on N and 6.8% of the line.
- The threshold is N ≥ 25,400, committed in f0c48d1 ([section 6](THESIS.md#6-what-would-change-my-mind)). The line is 1% of the Base x402 count frozen on 2026-10-30, so it does not depend on NEAR data. The check is in [PREREG-VERIFY.md](PREREG-VERIFY.md).
- [THESIS.md](THESIS.md) holds the claim, the evidence, and that threshold.

This is an entry for the NEAR HACKATHON track "Investment Thesis".

## The pre-registered line

The history of this branch contains commit `f0c48d13ed5af6147daa0e7a0b444855f3186770` (`f0c48d1`), so a third party can see the line as it was committed. Commit `f0c48d1` is tagged `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the digest posted on NEAR (see [PREREG-VERIFY.md](PREREG-VERIFY.md)).

## Try it

Node 20 or newer. Nothing to install.

- Run `node thesis.mjs --offline`.
- See `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. Only `generated_at` in `data/thesis.json` and `docs/thesis.json` changes.
- While `relay-census.json` is absent, the line adds `relay census not fetched`.

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

## Disclosure

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in https://nearhackathon.com/HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. The vet402 export starts on 2026-08-14 and is baseline data from before the window. The classification, the checks, the model, the dashboard and this thesis were written in the window. The first commit is dated 2026-10-30 (JST).

No third-party packages are used. The code was written with AI coding agents (Claude and Grok), then run and checked by me.

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

vet402 is a product I run, and a finding that delivery records matter would help it.

This is not investment advice.
