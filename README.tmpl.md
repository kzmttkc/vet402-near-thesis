# NEAR in agent payments: a thesis you can rerun

NEAR's edge in agent payments is the funding and settlement layer: NEAR Intents already settles cross-chain agent payments, and x402 has had a NEAR settlement spec since {{field:near.spec.pr_merged_at}} UTC that is ready but not yet lit. The known x402 facilitators, `x402-relayer2.mike.near`, `x402-relayer.mike.near`, `solvador.near`, and `uvd-facilitator.near`, settled {{n:near.known.named_delegate}} exact-scheme payments {{range:near.known.lower}}.

`uvd-facilitator.near` signed {{n:near.known.uvd_signer_txs}} transactions in that window: {{n:near.known.uvd_ft_transfer_call}} Delegate `ft_transfer_call` to NEAR USDC and {{n:near.known.uvd_escrow_calls}} calls on `v1.arras-escrow.near` ({{n:near.known.uvd_withdraw_for}} `withdraw_for`, {{n:near.known.uvd_release}} `release`, {{n:near.known.uvd_refund}} `refund`). Those may be an escrow scheme of x402. This page does not classify them as x402 or as not x402. Its exact-scheme Delegate USDC `ft_transfer` count is {{n:near.known.uvd_delegate}}.

The exact-scheme spec is merged and the facilitators are named. That is the strongest evidence that the exact scheme has not lit. The argument, the evidence, and the number that would change my mind are in [THESIS.md](THESIS.md). Every figure about the market and about vet402 below comes from this repository, either from one script you can rerun without a key or an account, or from a quote in the table at the end.

## Where this stands (2026-11-07)

- As of 2026-10-30, x402scan cannot count x402 settlement on NEAR. NEAR Intents already settles payments across chains. The x402 NEAR settlement spec is present. N, the delegate-action count on NEAR, is not frozen yet.
- The threshold is N ≥ {{n:threshold.line}}, committed in f0c48d1. The line is 1% of the Base x402 count frozen on 2026-10-30, so it does not depend on NEAR data. The check is in [PREREG-VERIFY.md](PREREG-VERIFY.md).
- [THESIS.md](THESIS.md) holds the claim, the evidence, and that threshold.

This is an entry for the NEAR HACKATHON track "Investment Thesis", which is judged on the evidence.

## The pre-registered line

The history of this branch contains commit `f0c48d13ed5af6147daa0e7a0b444855f3186770` (`f0c48d1`), so a third party can see the line as it was committed. At publication, the executive tags that commit `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the digest posted on NEAR (see [PREREG-VERIFY.md](PREREG-VERIFY.md)).

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. It rewrites `data/thesis.json` and `docs/thesis.json`; only `generated_at` changes. NEAR from that same frozen snapshot, with no network: the settlement spec is present ({{n:near.spec.settlement_sentence}}), the opt-in catalog lists {{n:near.facilitator.discovery_total}} resources, the named relayer has {{n:near.relayer.payments}} payments, and N's line is {{n:threshold.line}}. The known relay accounts sum to {{n:near.known.lower}}, a lower bound on N and {{n:near.known.lower_share_of_line}} of the line, and that reading is {{field:near.known.reading}}. The biased sample estimate is in the appendix and is not used in the claim. Stdout is one line and ends with `full count not yet fetched` while `relay-census.json` is absent. |
| `node online/fetch-intents-sample.mjs --offline` | Reprints the frozen intents.near index sample with no network: {{n:near.intents.sample_rows}} rows, {{n:near.intents.payment_count}} payment-scale settlement, {{range:near.intents.sample_rows}}, blocks {{field:near.intents_sample.height_min}} to {{field:near.intents_sample.height_max}}. |
| `node thesis.mjs --fetch-relays` | The known relay accounts over 30 days, through the FastNEAR transaction API (`POST /v0/account` and `POST /v0/transactions`). It writes `data/snapshot/near/facilitators.json` and reuses the Delegate match from the relayer census. It does not page NearBlocks. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. The script builds this page again from `README.tmpl.md` and `data/thesis.json` and compares it line by line, so an edited figure on this page shows up as a mismatch. Figures typed into the template itself are not covered by this check. The quotes cover them. |
| `node thesis.mjs --check-quotes` | `missing: 0`. Each quote below is fetched again and found word for word. Web pages are read directly, X posts through the public fxtwitter API, and the one PDF is reported as not machine-checked. |
| `node --test` | All tests pass with no network, including one that stops on an unknown purchase status and one that rebuilds from the frozen snapshot in a throwaway copy and compares it with the committed `data/thesis.json`. |
| `node --test online/fetch-compare.mjs` | Needs the network. A throwaway copy fetches the public sources, then `--offline` rebuilds, and the two sets of numbers match. This file sits outside `test/`, so `npm test` does not run it. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard. The same numbers, each with its range, date and source, and a count of any figure missing one of them. |

The vet402 export behind this page has sha256 `{{snapshot.sha256}}` and was retrieved {{snapshot.retrieved_at}}. The derived copy in this repository, `data/snapshot/export.derived.csv`, has sha256 `{{snapshot.derived_sha256}}`.

## What NEAR can run on this machine

Two pieces run on this machine. Neither one sends a mainnet transaction.

`facilitator/` is a reference facilitator for the NEAR exact scheme, plus a delivery receipt at `POST /receipt`. The chain is an in-process mock of JSON-RPC on `127.0.0.1`. The signed delegate is canonical JSON, not the Borsh `SignedDelegateAction` a production facilitator verifies.

```
node --test test/22-facilitator.test.mjs
```

Expected: `✔ mock NEAR RPC, not a sandbox: buyer payment, facilitator settle, seller receipt` and `ℹ fail 0`.

`spec/delivery-proof.md` is a proposal that adds a delivery proof on top of NEAR exact. It does not change that scheme's settlement rules.

```
node --test test/21-delivery-proof.test.mjs
```

Expected: `✔ frozen vectors: valid receipt, tampered body, reused payment, forged signature` and `ℹ fail 0`.

## Terms

{{definitions.table}}

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements and say nothing about demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

x402scan lists Base, Solana, Polygon and Optimism. Polygon and Optimism show zero in the latest 30 days, so the total below is Base plus Solana: {{n:x402.total.amount_30d}} of x402 payments (retrieved {{asof:x402.total.amount_30d}} UTC). Base carried {{n:x402.base.share_amount_30d}} of the dollars and {{n:x402.base.share_count_30d}} of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`). The report calls the figures in its section 1 raw onchain totals and gives adjusted figures without wash and test transactions elsewhere. Section 3.3 does not say which kind it uses. Nothing here is adjusted.

The word settlement is used for two different records. NEAR Intents settles a payment by moving value across chains, through its solver network. x402 settlement on NEAR is a USDC transfer that is a delegate action on NEAR itself. x402scan's chain filter accepts only those four chains (its answer to a NEAR filter is saved in `data/snapshot/x402scan/near-rejected.json`), so x402scan cannot count the second one. The count this thesis uses for that second one is N, defined in [THESIS.md](THESIS.md): delegate-action USDC `ft_transfer`s on NEAR in 30 days. The line is N ≥ {{n:threshold.line}}. The full count is not in the snapshot yet, so this page does not say that flow has reached the line. As of 2026-10-29, Base is where x402scan can see agent payments settle. That is not a measurement of N.

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

Of {{n:near.intents.sample_rows}} recent intents.near index rows {{range:near.intents.sample_rows}}, blocks {{field:near.intents_sample.height_min}} to {{field:near.intents_sample.height_max}}, {{n:near.intents.payment_count}} is a payment-scale settlement, not the delegate-action count N.

## 4. The model

In the 30 days to 2026-10-29, x402 was {{model.ratio}} of NEAR Intents volume. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

Each cell is a yearly amount, the 30-day x402 figure times 12, that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is {{model.fee_rate}}, cumulative fees over cumulative volume, and NEAR keeps its reported lifetime share of those fees, {{model.input.take_rate}} (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The same report gives a trailing 30-day share of {{model.input.take_rate_trailing_30d}} (quote `near_q3.capture_30d`). Using it would raise every cell by about {{model.input.trailing_over_lifetime}} times. NEAR reports {{model.input.q3_intents_usd}} for Q3 (quote `near_q3.q3_volume`). DefiLlama's daily sum for the same quarter is {{model.q3_gap}} lower. The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

{{model.table}}

The largest cell is a yearly figure. For comparison, NEAR captured over {{model.input.buyback_usd}} for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). The largest cell stays below that buyback figure.

My opinion, which this data does not test: funding, and a record of what arrived, are the part I claim for NEAR. Cross-chain settlement through NEAR Intents is already that funding layer. x402 settlement on NEAR, the delegate-action count N, is a different question, and this model does not answer it.

## 5. Arguments against

x402 settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). That sentence is about a transfer settling on NEAR, not about Intents moving value across chains. The number that would make that path the claim is N ≥ {{n:threshold.line}}, where N is the 30-day count of delegate-action USDC transfers defined in [THESIS.md](THESIS.md). The known relay accounts sum to {{n:near.known.lower}} {{range:near.known.lower}}. That sum is a lower bound on N, {{n:near.known.lower_share_of_line}} of the line. `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c` is not named by any facilitator `/supported` response. It is a generic relay. Its {{n:near.known.generic_delegate}} delegate-action USDC transfers are not known to be x402. They are counted only as a lower bound on N. Unknown relay accounts would raise N. The evidence in hand sits below the line. The upper bound on all of N cannot be measured without a key, so the reading is {{field:near.known.reading}}. The biased sample estimate is in the appendix. It is not used in the claim. Base at {{n:x402.base.share_amount_30d}} of x402 dollars is where x402scan can see volume. It does not measure N. With a GCP account you can count the overall upper bound on N with `sql/n-upper-bound.sql` against `bigquery-public-data.crypto_near_mainnet_us`.

## 6. What would change my mind

The condition is the one in [THESIS.md](THESIS.md). I will drop the claim that x402 settlement on NEAR is specified but not yet in use, and say that x402 settlement on NEAR is itself a place where NEAR earns, if this holds:

> **N ≥ {{n:threshold.line}}**, where N is the number of NEAR delegate-action USDC transfers in a 30-day window, and {{n:threshold.line}} is 1% of the x402 payments counted on Base over 30 days.

N counts a NEAR transaction only when all of these are true. It carries a `Delegate` action. The delegate's `receiver_id` is the NEAR USDC contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`. That action holds exactly one `ft_transfer`. The inner transfer succeeded. The block time falls in the 30 days that end at the fetch. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound, tilted against the claim. A higher N can only make me change my mind sooner.

The line is the next whole number above 1% of the Base count frozen on 2026-10-30, in `data/snapshot/x402scan/base.json`. A later NEAR fetch cannot move it. The reading rule for a partial count is in [THESIS.md](THESIS.md).

## 7. What I watch

Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of {{n:threshold.line}}.

| Indicator | Where it comes from in this repository |
|---|---|
| x402 dollars and payments by chain, 30 days | `lib/sources/x402scan.mjs` |
| NEAR Intents volume, 30 days and all time | `lib/sources/defillama.mjs` |
| USDC sent out of the NEAR Intents treasury on Base | `lib/sources/vault.mjs` (`--fetch-vault`) |
| Settled and delivered purchases in vet402's sample | `lib/classify.mjs` on the vet402 export |
| N, delegate-action USDC transfers on NEAR, 30 days | `data/snapshot/near/facilitators.json`, via `lib/sources/fastnear-census.mjs` (`node thesis.mjs --fetch-relays`). The full walk in `lib/sources/relay-census.mjs` is not frozen. |

As of 2026-10-30, x402scan does not list NEAR. N is the count used here for x402 settlement on NEAR, and it includes delegate-action USDC transfers that are not x402. If x402scan starts listing NEAR, that row belongs here too.

The windows do not line up to the hour. DefiLlama counts whole days, x402scan runs to its latest block, and the treasury count uses the block range above.

## Appendix: biased sample estimate

This estimate is a reference. It is not used in the claim.

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

The export comes from https://vet402.com/api/v1/observatory/export.csv?days=365 under CC BY 4.0, and its sha256 is given at the top. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`). No third-party packages are used. The code was written with AI coding agents (Claude and Grok), then run and checked by me.
