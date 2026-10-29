# NEAR in agent payments: a thesis you can rerun

Agent payments settle on Base today. NEAR can own everything around the payment: funding the agent, moving money across chains, and proving what the money bought. Every number on this page comes from one script in this repository, and you can rerun it without a key or an account.

This is an investment thesis for the NEAR HACKATHON track "Investment Thesis". It is judged on evidence, so the evidence comes first and the opinion comes last.

## Try it

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. No network, no key. Node 20 or newer, nothing to install. |
| `node --test` | Every test passes, including the one that stops on an unknown purchase status. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. Every figure here matches `data/thesis.json`. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard: the same numbers, each with its range, date and source. |

The snapshot behind this page: vet402 export sha256 `43efa1c2694f9e95eaa6ef771358ff9aa9c1756a1cd3f967cbc3b95b366eb077`, retrieved 2026-10-29T22:04:40.090Z.

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

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements. They are not demand, and vet402 labels them as tests in its own export.

## 1. Where agent payments settle

In the latest 30 days on x402scan (retrieved 2026-10-29 23:18 UTC), x402 moved $1,579,185 across all chains. Base carried 73.0% of the dollars and 77.3% of the payments.

Visa and Artemis reach the same place on a longer window. Their report says Base carries "the vast majority of transaction volume" (data as of April 21, 2026, quote `visa_artemis.base` below).

So NEAR is not where agent payments settle today. This thesis does not depend on that changing.

## 2. Paying is not the whole job

vet402 paid real x402 sellers from 2026-08-14 09:54 to 2026-10-29 21:32 UTC. Of 18,683 attempts, 12,223 settled on chain and 11,189 of those came back with an HTTP 2xx answer (91.5% of settled).

The gap is not all the sellers' fault. 698 settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out. After that, 336 settled purchases (2.9%) paid and got nothing usable back, with no explanation in the record.

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

The settlements themselves hold up. I rechecked 100 Base and 100 Solana settlements from this export against public RPCs: 100 and 100 matched. Other chains are not rechecked.

A person who lets an agent spend has no easy way to see the gap. The agent paid. Whether the answer arrived is a separate question, and nobody records it for them. Illia Polosukhin points at the same need from the NEAR side: a verifiable audit link for each payment (quote `illia.audit_link`).

## 3. NEAR already moves money around payments

NEAR Intents moved $3.97B in its latest 30 days on DefiLlama (retrieved 2026-10-29 23:18 UTC). The need shows up on the user side too. Eddy Lazzarin wrote that one balance in his wallet pays to and from almost any chain (quote `eddy.any_chain`). His post does not mention NEAR, so it shows demand for the layer, not a win for NEAR.

On Base alone, the NEAR Intents treasury sent out $41.05M of USDC in 45,840 transfers over blocks 51965969 to 53261969. That is all purposes, not only payments. It is a separate flow from x402 and appears here only for scale: about 36 times the x402 dollars on Base in a similar 30 days.

NEAR Foundation says the same thing in its own words (quote `near_blog.around_payment`): an agent pays through x402 and relies on NEAR for everything around that payment.

## 4. The model

Today x402 is 0.040% of NEAR Intents volume over 30 days. At today's size, x402 does almost nothing for NEAR. The table asks what it would take.

Each cell is a yearly amount that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents. It uses NEAR's own figures: a fee rate of 0.163% (cumulative fees over cumulative volume) and NEAR's share of those fees (quotes `near_q3.fees_buyback` and `near_q3.capture`). The report gives floors, so the model uses floors.

| Multiple | 1% | 10% | 50% |
| --- | --- | --- | --- |
| 1x | $51 | $505 | $2,525 |
| 10x | $505 | $5,050 | $25,251 |
| 100x | $5,050 | $50,502 | $252,512 |
| 1000x | $50,502 | $505,023 | $2,525,117 |

Even the largest cell, 1000 times today's x402 volume with half of it passing through NEAR, is smaller than what NEAR has already captured for buybacks (quote `near_q3.fees_buyback`). The value in this thesis is not x402 fees. It is that the services around an agent payment (funding, cross-chain movement, a record that the money bought something) are a better fit for NEAR than settlement is.

## 5. Arguments against

Settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" (quote `near_blog.settlement`). With Base at 73.0% of x402 dollars, the numbers here do not support that path today.

Agents may not need crypto at all. Haseeb Qureshi put it plainly (quote `haseeb.humans`). I agree, and it supports this thesis. The person behind the agent is the one who needs a way to fund it and a way to check what it bought. That is the layer around the payment.

## 6. The bull case

NEAR would compete on settlement too if three things happened together: x402 sellers started accepting payment on NEAR, NEAR Intents became the default way agents fund themselves across chains, and buyers began to ask for proof of delivery before paying again. The indicators below would show the first two before anyone could argue for the third.

## 7. What would change my mind

- The share of x402 dollars on Base falls below half and the new share goes somewhere other than NEAR.
- The NEAR Intents treasury on Base sends out less USDC for three months in a row.
- The share of settled purchases that return nothing usable falls close to zero across sellers, so nobody needs a check around the payment.

## 8. Indicators to watch

| Indicator | Source in this repository |
|---|---|
| x402 dollars and payments by chain, 30 days | `lib/sources/x402scan.mjs` |
| NEAR Intents volume, 30 days and all time | `lib/sources/defillama.mjs` |
| USDC sent out of the NEAR Intents treasury on Base | `lib/sources/vault.mjs` (`--fetch-vault`) |
| Settled and delivered purchases | `lib/classify.mjs` on the vet402 export |

## Quotes

Every quote is a full sentence with its link and one line of context. Quotes that argue against this thesis are in the same table.

| id | sentence | url | context |
| --- | --- | --- | --- |
| near_q3.cumulative | Cumulative Intents volume increased from ~$22 billion at the end of Q2, to over $32 billion at the end of Q3, a 45% QoQ increase. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19, section on the NEAR Intents fee switch. |
| near_q3.fees_buyback | The September traction report for NEAR Intents reported over $52 million in cumulative fees, with over $8 million captured by NEAR and directed toward buybacks. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report and section. The figures come from NEAR's September traction report. |
| near_q3.capture | As of October 6, lifetime fee capture stands at approximately 16.4%, up 4.9% from the 11.5% in Q2. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report. The next sentences define capture as net revenue retained per dollar of gross fees and give the trailing 30-day rate of 28.4%. |
| near_q3.q3_volume | In Q3 2026, the near.com front-end processed ~$2.57 billion in volume, which was roughly a quarter of the total volume on NEAR Intents ($10.4 billion). | https://x.com/NEARProtocol/status/2112225472071311506 | Same report, section on near.com. This is the only place the report states Q3 Intents volume. |
| near_blog.around_payment | The intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. | https://www.near.org/blog/near-foundation-joins-x402-foundation | NEAR Foundation, "NEAR Foundation Joins the x402 Foundation", 2026-07-14. |
| near_blog.alongside | NEAR joins as a builder of key agent infrastructure, including cross-chain liquidity, confidential execution, private inference, and agent-to-agent discovery and coordination that is needed alongside x402’s payments protocol. | https://www.near.org/blog/near-foundation-joins-x402-foundation | Same post, opening section. |
| near_blog.settlement | Today, NEAR offers a combination of capabilities across its tech stack that intends to bring them together as one system that works alongside x402: universal liquidity and confidential execution through NEAR Intents, private inference and a secure agent harness through NEAR AI, agent-to-agent discovery and coordination through the NEAR Agent Market, and scalable, quantum-resistant settlement through NEAR Protocol. | https://www.near.org/blog/near-foundation-joins-x402-foundation | Same post. This sentence also names settlement on NEAR Protocol, which argues against the thesis below. |
| visa_artemis.base | In practice, activity today is concentrated on Base, Solana, and Polygon, with Base carrying the vast majority of transaction volume. | https://www.visa.com/vcom-assets/content/dam/visa/reimagine-visa/thought-leadership/documents/agentic-payments-report.pdf | Visa and Artemis Analytics, agentic payments report, section 3.3. Footnote 2 dates the data to April 21, 2026. |
| illia.audit_link | Each payment can generate a verifiable audit link + can share view key for audit of the full books. | https://x.com/ilblackdragon/status/2112768975855907186 | Illia Polosukhin, reply on X, 2026-10-21. |
| eddy.any_chain | I float a balance in Alcove and I can send/receive payments to/from basically any blockchain at nearly no cost. | https://x.com/eddylazzarin/status/2112596538119848324 | Eddy Lazzarin, post on X, 2026-10-20, about the Alcove wallet. The next sentence says this used to take a stack of tools. The post does not mention NEAR. |
| haseeb.humans | Agents don't need crypto. It's us humans who do. | https://x.com/hosseeb/status/2112182846110732348 | Haseeb Qureshi, post on X, 2026-10-19, introducing his TOKEN2049 talk. This argues against agent-first theses, including this one. |

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

This is not investment advice.

## About this repository

vet402 is an existing product that buys from x402 sellers on several chains and publishes every attempt. This repository is new work for NEAR HACKATHON: the script, the snapshot, the model, the dashboard and this thesis. The vet402 export is public data under CC BY 4.0, cited by URL and sha256. The derived copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here.
