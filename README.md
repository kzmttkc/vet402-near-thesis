# NEAR in agent payments: a thesis you can rerun

NEAR's edge in agent payments is the funding and settlement layer: NEAR Intents already settles cross-chain agent payments, and x402 has had a NEAR settlement spec since 2026-05-16 14:01 UTC that is ready but not yet lit. The known x402 facilitators, `x402-relayer2.mike.near`, `x402-relayer.mike.near`, `solvador.near`, and `uvd-facilitator.near`, settled 0 exact-scheme payments from 2026-10-08 11:42 to 2026-11-07 11:42 UTC.

`uvd-facilitator.near` signed 51 transactions in that window: 14 Delegate `ft_transfer_call` to NEAR USDC and 37 calls on `v1.arras-escrow.near` (24 `withdraw_for`, 11 `release`, 2 `refund`). Those may be an escrow scheme of x402. This page does not classify them as x402 or as not x402. Its exact-scheme Delegate USDC `ft_transfer` count is 0.

The exact-scheme spec is merged and the facilitators are named, yet they settled 0 exact-scheme payments in those 30 days. That gap is the strongest evidence that the exact scheme has not lit. The argument, the evidence, and the number that would change my mind are in [THESIS.md](THESIS.md). Every figure about the market and about vet402 below comes from this repository, either from one script you can rerun without a key or an account, or from a quote in the table at the end.

## Where this stands (2026-11-07)

- As of 2026-10-30, x402scan cannot count x402 settlement on NEAR. NEAR Intents already settles payments across chains. The x402 NEAR settlement spec is present. N, the delegate-action count on NEAR, is not frozen yet.
- The threshold is N ≥ 25,400, committed in f0c48d1. The line is 1% of the Base x402 count frozen on 2026-10-30, so it does not depend on NEAR data. The check is in [PREREG-VERIFY.md](PREREG-VERIFY.md).
- [THESIS.md](THESIS.md) holds the claim, the evidence, and that threshold.

This is an entry for the NEAR HACKATHON track "Investment Thesis", which is judged on the evidence.

## The pre-registered line

The history of this branch contains commit `f0c48d13ed5af6147daa0e7a0b444855f3186770` (`f0c48d1`), so a third party can see the line as it was committed. At publication, the executive tags that commit `prereg-threshold`. `git show prereg-threshold:THESIS.md | shasum -a 256` prints the digest posted on NEAR (see [PREREG-VERIFY.md](PREREG-VERIFY.md)).

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. It rewrites `data/thesis.json` and `docs/thesis.json`; only `generated_at` changes. NEAR from that same frozen snapshot, with no network: the settlement spec is present (1), the opt-in catalog lists 0 resources, the named relayer has 6 payments, and N's line is 25,400. The known relay accounts sum to 1,716, a lower bound on N and 6.8% of the line, and that reading is not decided. The biased sample estimate is in the appendix and is not used in the claim. Stdout is one line and ends with `full count not yet fetched` while `relay-census.json` is absent. |
| `node online/fetch-intents-sample.mjs --offline` | Reprints the frozen intents.near index sample with no network: 30 rows, 1 payment-scale settlement, from 2026-11-07 16:18 to 2026-11-07 16:20 UTC, blocks 223490307 to 223490446. |
| `node thesis.mjs --fetch-relays` | The known relay accounts over 30 days, through the FastNEAR transaction API (`POST /v0/account` and `POST /v0/transactions`). It writes `data/snapshot/near/facilitators.json` and reuses the Delegate match from the relayer census. It does not page NearBlocks. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. The script builds this page again from `README.tmpl.md` and `data/thesis.json` and compares it line by line, so an edited figure on this page shows up as a mismatch. Figures typed into the template itself are not covered by this check. The quotes cover them. |
| `node thesis.mjs --check-quotes` | `missing: 0`. Each quote below is fetched again and found word for word. Web pages are read directly, X posts through the public fxtwitter API, and the one PDF is reported as not machine-checked. |
| `node --test` | All tests pass with no network, including one that stops on an unknown purchase status and one that rebuilds from the frozen snapshot in a throwaway copy and compares it with the committed `data/thesis.json`. |
| `node --test online/fetch-compare.mjs` | Needs the network. A throwaway copy fetches the public sources, then `--offline` rebuilds, and the two sets of numbers match. This file sits outside `test/`, so `npm test` does not run it. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard. The same numbers, each with its range, date and source, and a count of any figure missing one of them. |

The vet402 export behind this page has sha256 `43efa1c2694f9e95eaa6ef771358ff9aa9c1756a1cd3f967cbc3b95b366eb077` and was retrieved 2026-10-29T22:04:40.090Z. The derived copy in this repository, `data/snapshot/export.derived.csv`, has sha256 `e47ebcf5915ca3d9ac889ae75d52ec653a54964a5dc85a0d793ffe2465744e4c`.

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

| Term | Definition |
| --- | --- |
| row | A row in the vet402 observatory export. |
| attempt | A row with a network. Rows without one never reached a payee and are counted separately as not_attempt. |
| not_attempt | A row without a network: no_eligible_accept, over_cap, no_402, price_mismatch, no_fee_payer or payto_mismatch. |
| settled | A row whose status is settled, with held_reason empty or settled_4xx. |
| delivered | A settled row whose http_status_paid is 2xx, 202 Accepted included. The count without 202 is reported too. The public CSV has no column for an empty body, so a rerun cannot check that. |
| pending | A row whose status is delivered_no_receipt (a 2xx answer with no tx yet) or settle_claimed (the seller named a tx that is not confirmed). |
| not_settled | A row with a network whose status is settle_failed (payer_unfunded, unsettled_4xx or empty) or settle_claim_refuted. |
| held | A settled row with held_reason settled_4xx. The 4xx may come from how vet402 asked, so vet402 leaves it out of its own rates. |
| unexplained | A settled row that is neither 2xx nor held. |

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements and say nothing about demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

x402scan lists Base, Solana, Polygon and Optimism. Polygon and Optimism show zero in the latest 30 days, so the total below is Base plus Solana: $1,579,185 of x402 payments (retrieved 2026-10-29 23:18 UTC). Base carried 73.0% of the dollars and 77.3% of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`). The report calls the figures in its section 1 raw onchain totals and gives adjusted figures without wash and test transactions elsewhere. Section 3.3 does not say which kind it uses. Nothing here is adjusted.

The word settlement is used for two different records. NEAR Intents settles a payment by moving value across chains, through its solver network. x402 settlement on NEAR is a USDC transfer that is a delegate action on NEAR itself. x402scan's chain filter accepts only those four chains (its answer to a NEAR filter is saved in `data/snapshot/x402scan/near-rejected.json`), so x402scan cannot count the second one. The count this thesis uses for that second one is N, defined in [THESIS.md](THESIS.md): delegate-action USDC `ft_transfer`s on NEAR in 30 days. The line is N ≥ 25,400. The full count is not in the snapshot yet, so this page does not say that flow has reached the line. As of 2026-10-29, Base is where x402scan can see agent payments settle. That is not a measurement of N.

## 2. A payment and a delivered answer are two different records

vet402 tried to buy from x402 sellers from 2026-08-14 09:54 to 2026-10-29 21:32 UTC. Of 18,683 attempts, 12,223 settled. For 13 of those, all on Arc mainnet (eip155:5042), the export has no transaction hash. For 11,194 of the settled purchases, the export records the seller's claim as the evidence of settlement. The rechecks below cover samples of those on Base and Solana. Of the settled purchases, 11,189 came back with an HTTP 2xx answer (91.5%).

698 settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out of its own rates. Of the 11,525 settled purchases left, 336 (2.9%) paid and got no usable answer, with no explanation in the record.

Every row lands in exactly one group. An unknown status stops the script instead of falling into "other".

| Group | status | held_reason | tx | 2xx | Count |
| --- | --- | --- | --- | --- | --- |
| 1-not-settled | settle_claim_refuted |  | true | true | 3 |
| 1-not-settled | settle_failed |  | false | false | 1,105 |
| 1-not-settled | settle_failed |  | false | true | 2 |
| 1-not-settled | settle_failed |  | true | false | 3 |
| 1-not-settled | settle_failed | payer_unfunded | false | false | 1,032 |
| 1-not-settled | settle_failed | unsettled_4xx | false | false | 4,181 |
| 2-pending | delivered_no_receipt |  | false | true | 108 |
| 2-pending | settle_claimed |  | true | true | 26 |
| 3-settled | settled |  | false | true | 12 |
| 3-settled | settled |  | true | false | 336 |
| 3-settled | settled |  | true | true | 11,177 |
| 3-settled | settled | settled_4xx | false | false | 1 |
| 3-settled | settled | settled_4xx | true | false | 697 |
| 4-not-an-attempt | no_402 |  | false | false | 143 |
| 4-not-an-attempt | no_eligible_accept |  | false | false | 937 |
| 4-not-an-attempt | no_fee_payer |  | false | false | 41 |
| 4-not-an-attempt | over_cap |  | false | false | 169 |
| 4-not-an-attempt | payto_mismatch |  | false | false | 29 |
| 4-not-an-attempt | price_mismatch |  | false | false | 56 |

I rechecked 100 Base and 100 Solana settlements from this export against public RPCs. On Base, 100 receipts succeeded and carry a USDC transfer of exactly the purchase amount. On Solana, 100 transactions succeeded and credit one USDC account with exactly that amount. The recheck does not compare the payee with the seller, because the export does not list the payee. Other chains are not rechecked.

vet402 records whether each answer arrived for its own purchases, and the gap above is what that record shows.

## 3. NEAR already moves money around payments

NEAR Intents moved $3.97B in its latest 30 days on DefiLlama (retrieved 2026-10-29 23:18 UTC).

NEAR Intents lists `0x2CfF890f0378a11913B6129B2E97417a2c302680` as its treasury address on EVM chains, Base included (quote `near_intents.treasury`). On Base, over blocks 51965969 to 53261969, that address sent out $41.05M of USDC in 45,840 transfers. The transfers carry no label, so this counts every purpose, and the data here cannot say how much of it, if any, is x402. For scale only, it is about 36 times the x402 dollars on Base over a similar 30 days.

NEAR Foundation names the same layer (quote `near_blog.around_payment`). Its stated intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. This section is the cross-chain settlement, the movement through Intents. It is not a count of x402 settlement on NEAR. The same post also names settlement on NEAR Protocol, covered in section 5.

Of 30 recent intents.near index rows from 2026-11-07 16:18 to 2026-11-07 16:20 UTC, blocks 223490307 to 223490446, 1 is a payment-scale settlement, not the delegate-action count N.

## 4. The model

In the 30 days to 2026-10-29, x402 was 0.040% of NEAR Intents volume. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

Each cell is a yearly amount, the 30-day x402 figure times 12, that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is 0.1625%, cumulative fees over cumulative volume, and NEAR keeps its reported lifetime share of those fees, 16.4% (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The same report gives a trailing 30-day share of 28.4% (quote `near_q3.capture_30d`). Using it would raise every cell by about 1.7 times. NEAR reports $10.4 billion for Q3 (quote `near_q3.q3_volume`). DefiLlama's daily sum for the same quarter is 5.9% lower. The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

| Multiple | 1% | 10% | 50% |
| --- | --- | --- | --- |
| 1x | $51 | $505 | $2,525 |
| 10x | $505 | $5,050 | $25,251 |
| 100x | $5,050 | $50,502 | $252,512 |
| 1000x | $50,502 | $505,023 | $2,525,117 |

The largest cell is a yearly figure. For comparison, NEAR captured over $8 million for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). The largest cell stays below that buyback figure.

My opinion, which this data does not test: funding, and a record of what arrived, are the part I claim for NEAR. Cross-chain settlement through NEAR Intents is already that funding layer. x402 settlement on NEAR, the delegate-action count N, is a different question, and this model does not answer it.

## 5. Arguments against

x402 settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). That sentence is about a transfer settling on NEAR, not about Intents moving value across chains. The number that would make that path the claim is N ≥ 25,400, where N is the 30-day count of delegate-action USDC transfers defined in [THESIS.md](THESIS.md). The known relay accounts sum to 1,716 from 2026-10-08 11:42 to 2026-11-07 11:42 UTC. That sum is a lower bound on N, 6.8% of the line. `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c` is not named by any facilitator `/supported` response. It is a generic relay. Its 1,716 delegate-action USDC transfers are not known to be x402. They are counted only as a lower bound on N. Unknown relay accounts would raise N. The evidence in hand sits below the line. The upper bound on all of N cannot be measured without a key, so the reading is not decided. The biased sample estimate is in the appendix. It is not used in the claim. Base at 73.0% of x402 dollars is where x402scan can see volume. It does not measure N. With a GCP account you can count the overall upper bound on N with `sql/n-upper-bound.sql` against `bigquery-public-data.crypto_near_mainnet_us`.

## 6. What would change my mind

The condition is the one in [THESIS.md](THESIS.md). I will drop the claim that x402 settlement on NEAR is specified but not yet in use, and say that x402 settlement on NEAR is itself a place where NEAR earns, if this holds:

> **N ≥ 25,400**, where N is the number of NEAR delegate-action USDC transfers in a 30-day window, and 25,400 is 1% of the x402 payments counted on Base over 30 days.

N counts a NEAR transaction only when all of these are true. It carries a `Delegate` action. The delegate's `receiver_id` is the NEAR USDC contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`. That action holds exactly one `ft_transfer`. The inner transfer succeeded. The block time falls in the 30 days that end at the fetch. N also includes delegate-action USDC transfers that are not x402, so N is an upper bound, tilted against the claim. N bounds exact-scheme x402 only; escrow-scheme calls such as uvd-facilitator.near's are outside N. A higher N can only make me change my mind sooner.

The line is the next whole number above 1% of the Base count frozen on 2026-10-30, in `data/snapshot/x402scan/base.json`. A later NEAR fetch cannot move it. The reading rule for a partial count is in [THESIS.md](THESIS.md).

## 7. What I watch

Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of 25,400.

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

The frozen sample took 450 USDC `ft_transfer` receipts at 30 points, 15 at each point, and found 5 of the delegate shape. All 5 are signed by `5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c`. That signer's complete 30-day delegate-action count is 1,716. The sample share is about 12 times that signer's share of 1,837,873 USDC transfer events of every shape, so the sample over-represents that signer. All 30 sample points fall at 16:24 UTC. Scaling the sample share by those events gives 20,421, rounded to the nearest transfer. The one-sided 95% upper bound, assuming independent draws (the sample is 30 clusters of 15 receipts, so this is optimistic), is 42,675. Neither number is N.

## Quotes

Each quote is a full sentence with its link and one line of context. Quotes that argue against this thesis are in the same table. `node thesis.mjs --check-quotes` fetches each source again.

| id | sentence | url | context |
| --- | --- | --- | --- |
| near_q3.cumulative | Cumulative Intents volume increased from ~$22 billion at the end of Q2, to over $32 billion at the end of Q3, a 45% QoQ increase. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19, section on the NEAR Intents fee switch. |
| near_q3.fees_buyback | The September traction report for NEAR Intents reported over $52 million in cumulative fees, with over $8 million captured by NEAR and directed toward buybacks. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report and section. The figures come from NEAR's September traction report. |
| near_q3.capture | As of October 6, lifetime fee capture stands at approximately 16.4%, up 4.9% from the 11.5% in Q2. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report. The next sentences define capture as net revenue retained per dollar of gross fees and give the trailing 30-day rate of 28.4%. |
| near_q3.q3_volume | In Q3 2026, the near.com front-end processed ~$2.57 billion in volume, which was roughly a quarter of the total volume on NEAR Intents ($10.4 billion). | https://x.com/NEARProtocol/status/2112225472071311506 | Same report, section on near.com. This is the only place the report states Q3 Intents volume. |
| near_blog.around_payment | The intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. | https://www.near.org/blog/near-foundation-joins-x402-foundation | NEAR Foundation, "NEAR Foundation Joins the x402 Foundation", 2026-07-14. |
| near_blog.settlement | NEAR is building infrastructure that intends to bring them together as one system that works alongside x402: universal liquidity and confidential execution through NEAR Intents, private inference and a secure agent harness through NEAR AI, agent-to-agent discovery and coordination through the NEAR Agent Market, and scalable, quantum-resistant settlement through NEAR Protocol. | https://www.near.org/blog/near-foundation-joins-x402-foundation | Same post. This sentence also names settlement on NEAR Protocol, which argues against the thesis below. |
| visa_artemis.base | In practice, activity today is concentrated on Base, Solana, and Polygon, with Base carrying the vast majority of transaction volume. | https://www.visa.com/vcom-assets/content/dam/visa/reimagine-visa/thought-leadership/documents/agentic-payments-report.pdf | Visa and Artemis Analytics, agentic payments report, section 3.3. Footnote 2 dates the data to April 21, 2026. |
| haseeb.humans | Agents don't need crypto. It's us humans who do. | https://x.com/hosseeb/status/2112182846110732348 | Haseeb Qureshi, post on X, 2026-10-19. The post starts "I was wrong." and introduces his TOKEN2049 talk. He does not mention agent-first theses. I read the post as arguing against them. |
| near_intents.treasury | For transparency and AML compliance, below are the treasury and refill addresses used by NEAR Intents and HOT Bridge, listed by network. | https://docs.near-intents.org/security-compliance/treasury-addresses | NEAR Intents documentation, Treasury Addresses. Under EVM chains (Base included) it lists NEAR Intents at 0x2CfF890f0378a11913B6129B2E97417a2c302680. |
| near_q3.fee_switch | The fee switch for NEAR Intents has been live for seven months, capturing a portion of swap fees to fund NEAR buybacks. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19. The sentence right before near_q3.fees_buyback. |
| near_q3.capture_30d | Trailing 30-day capture is 28.4%, down 2.1% from Q2’s 30.5%, but still ~1.7x the lifetime rate. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19. The sentence right after near_q3.capture. |

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

vet402 is a product I run, and a finding that delivery records matter would help it.

This is not investment advice.

## About this repository

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in https://nearhackathon.com/HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. The vet402 export starts on 2026-08-14 and is baseline data from before the window. The classification, the checks, the model, the dashboard and this thesis were written in the window. The first commit is dated 2026-10-30 (JST).

The export comes from https://vet402.com/api/v1/observatory/export.csv?days=365 under CC BY 4.0, and its sha256 is given at the top. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`). No third-party packages are used. The code was written with AI coding agents (Claude and Grok), then run and checked by me.
