# NEAR in agent payments: a thesis you can rerun

Agent payments settle on Base today. The work around each payment, funding the agent and moving its money across chains, already runs at scale on NEAR Intents. This thesis argues that this layer, and not settlement, is where NEAR earns from agent payments. Every number below comes from one script in this repository, and you can rerun it without a key or an account.

This is an entry for the NEAR HACKATHON track "Investment Thesis", which is judged on the evidence. The evidence comes first and my opinion is marked as opinion.

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. Every figure here matches `data/thesis.json`. |
| `node thesis.mjs --check-quotes` | `missing: 0`. Each quote below is fetched again from its source and found word for word. The one PDF is reported as not machine-checked. |
| `node --test` | All tests pass in about a minute, including one that stops on an unknown purchase status and one that runs the offline build in a throwaway copy. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard. The same numbers, each with its range, date and source, and a count of any figure missing one of them. |

The vet402 export behind this page has sha256 `43efa1c2694f9e95eaa6ef771358ff9aa9c1756a1cd3f967cbc3b95b366eb077` and was retrieved 2026-10-29T22:04:40.090Z.

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

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements, not demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

In the latest 30 days on x402scan (retrieved 2026-10-29 23:18 UTC), x402 moved $1,579,185 across all chains. Base carried 73.0% of the dollars and 77.3% of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`).

NEAR carries almost none of today's x402 settlement. The thesis below starts from that fact.

## 2. A payment and a delivered answer are two different records

vet402 paid x402 sellers from 2026-08-14 09:54 to 2026-10-29 21:32 UTC. Of 18,683 attempts, 12,223 settled. For 13 of those, all on Arc mainnet (eip155:5042), the export has no transaction hash. Of the settled purchases, 11,189 came back with an HTTP 2xx answer (91.5%).

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

vet402 records whether each answer arrived for its own purchases, and the gap above is what that record shows. Illia Polosukhin describes a verifiable audit link for each payment (quote `illia.audit_link`). That covers the payer's books, which is one part of the same record.

## 3. NEAR already moves money around payments

NEAR Intents moved $3.97B in its latest 30 days on DefiLlama (retrieved 2026-10-29 23:18 UTC).

NEAR Intents lists `0x2CfF890f0378a11913B6129B2E97417a2c302680` as its treasury address on EVM chains, Base included (quote `near_intents.treasury`). On Base, over blocks 51965969 to 53261969, that address sent out $41.05M of USDC in 45,840 transfers. The transfers carry no label, so this counts every purpose, not only payments. It is a separate flow from x402. For scale only, it is about 36 times the x402 dollars on Base over a similar 30 days.

NEAR Foundation states the same aim (quote `near_blog.around_payment`): an agent pays through x402 and relies on NEAR for everything around that payment. Eddy Lazzarin wrote that one balance in his wallet pays to and from almost any chain (quote `eddy.any_chain`). His post is about a wallet that does not mention NEAR. I read it as a sign that people want this layer, not as evidence for NEAR.

## 4. The model

Today x402 is 0.040% of NEAR Intents volume over 30 days. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

Each cell is a yearly amount that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is 0.163%, cumulative fees over cumulative volume, and NEAR keeps its reported share of those fees (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

| Multiple | 1% | 10% | 50% |
| --- | --- | --- | --- |
| 1x | $51 | $505 | $2,525 |
| 10x | $505 | $5,050 | $25,251 |
| 100x | $5,050 | $50,502 | $252,512 |
| 1000x | $50,502 | $505,023 | $2,525,117 |

The largest cell is a yearly figure. For comparison, NEAR captured over $8 million for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). So x402 fees alone stay small next to what NEAR Intents already earns.

My opinion, which this data does not test: the services around an agent payment, funding and cross-chain movement and a record of what arrived, fit NEAR better than settlement does.

## 5. Arguments against

Settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). With Base at 73.0% of x402 dollars, the numbers here do not support that path today.

Agents may not need crypto. Haseeb Qureshi argues exactly that (quote `haseeb.humans`). If he is right, fewer agent payments touch any chain. The person behind an agent may still need a way to fund it and to check what it bought, but the data here does not test that.

## 6. What would change my mind

Rerun `node thesis.mjs` on the next 30-day window and compare.

- Base's share of x402 dollars falls below half and the share moves to a chain other than NEAR.
- USDC sent out of the NEAR Intents treasury on Base falls in each of the next three 30-day windows.
- In vet402's sample, the share of settled purchases with no usable answer falls close to zero, so a delivery record matters less.

## 7. What I watch

| Indicator | Where it comes from in this repository |
|---|---|
| x402 dollars and payments by chain, 30 days | `lib/sources/x402scan.mjs` |
| NEAR Intents volume, 30 days and all time | `lib/sources/defillama.mjs` |
| USDC sent out of the NEAR Intents treasury on Base | `lib/sources/vault.mjs` (`--fetch-vault`) |
| Settled and delivered purchases in vet402's sample | `lib/classify.mjs` on the vet402 export |

None of these measures whether x402 sellers accept payment on NEAR. If x402scan starts listing NEAR, that row belongs here.

The windows do not line up to the hour. DefiLlama counts whole days, x402scan runs to its latest block, and the treasury count uses the block range above.

## Quotes

Each quote is a full sentence with its link and one line of context. Quotes that argue against this thesis are in the same table. `node thesis.mjs --check-quotes` fetches each source again.

| id | sentence | url | context |
| --- | --- | --- | --- |
| near_q3.cumulative | Cumulative Intents volume increased from ~$22 billion at the end of Q2, to over $32 billion at the end of Q3, a 45% QoQ increase. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19, section on the NEAR Intents fee switch. |
| near_q3.fees_buyback | The September traction report for NEAR Intents reported over $52 million in cumulative fees, with over $8 million captured by NEAR and directed toward buybacks. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report and section. The figures come from NEAR's September traction report. |
| near_q3.capture | As of October 6, lifetime fee capture stands at approximately 16.4%, up 4.9% from the 11.5% in Q2. | https://x.com/NEARProtocol/status/2112225472071311506 | Same report. The next sentences define capture as net revenue retained per dollar of gross fees and give the trailing 30-day rate of 28.4%. |
| near_q3.q3_volume | In Q3 2026, the near.com front-end processed ~$2.57 billion in volume, which was roughly a quarter of the total volume on NEAR Intents ($10.4 billion). | https://x.com/NEARProtocol/status/2112225472071311506 | Same report, section on near.com. This is the only place the report states Q3 Intents volume. |
| near_blog.around_payment | The intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. | https://www.near.org/blog/near-foundation-joins-x402-foundation | NEAR Foundation, "NEAR Foundation Joins the x402 Foundation", 2026-07-14. |
| near_blog.alongside | NEAR joins as a builder of key agent infrastructure, including cross-chain liquidity, confidential execution, private inference, and agent-to-agent discovery and coordination that is needed alongside x402’s payments protocol. | https://www.near.org/blog/near-foundation-joins-x402-foundation | Same post, opening section. |
| near_blog.settlement | NEAR is building infrastructure that intends to bring them together as one system that works alongside x402: universal liquidity and confidential execution through NEAR Intents, private inference and a secure agent harness through NEAR AI, agent-to-agent discovery and coordination through the NEAR Agent Market, and scalable, quantum-resistant settlement through NEAR Protocol. | https://www.near.org/blog/near-foundation-joins-x402-foundation | Same post. This sentence also names settlement on NEAR Protocol, which argues against the thesis below. |
| visa_artemis.base | In practice, activity today is concentrated on Base, Solana, and Polygon, with Base carrying the vast majority of transaction volume. | https://www.visa.com/vcom-assets/content/dam/visa/reimagine-visa/thought-leadership/documents/agentic-payments-report.pdf | Visa and Artemis Analytics, agentic payments report, section 3.3. Footnote 2 dates the data to April 21, 2026. |
| illia.audit_link | Each payment can generate a verifiable audit link + can share view key for audit of the full books. | https://x.com/ilblackdragon/status/2112768975855907186 | Illia Polosukhin, reply on X, 2026-10-21, to a question about how an auditor gets the approval trail for confidential payouts. It is about the payer's books, not about whether an answer arrived. |
| eddy.any_chain | I float a balance in Alcove and I can send/receive payments to/from basically any blockchain at nearly no cost. | https://x.com/eddylazzarin/status/2112596538119848324 | Eddy Lazzarin, post on X, 2026-10-20, recommending the Alcove wallet. The next sentence says this used to take a stack of tools. The post does not mention NEAR. |
| haseeb.humans | Agents don't need crypto. It's us humans who do. | https://x.com/hosseeb/status/2112182846110732348 | Haseeb Qureshi, post on X, 2026-10-19. The post starts "I was wrong." and introduces his TOKEN2049 talk. It argues against agent-first theses, including this one. |
| near_intents.treasury | For transparency and AML compliance, below are the treasury and refill addresses used by NEAR Intents and HOT Bridge, listed by network. | https://docs.near-intents.org/security-compliance/treasury-addresses | NEAR Intents documentation, Treasury Addresses. Under EVM chains (Base included) it lists NEAR Intents at 0x2CfF890f0378a11913B6129B2E97417a2c302680. |
| near_q3.fee_switch | The fee switch for NEAR Intents has been live for seven months, capturing a portion of swap fees to fund NEAR buybacks. | https://x.com/NEARProtocol/status/2112225472071311506 | NEAR, "The State of NEAR: Q3 2026", 2026-10-19. The sentence right before near_q3.fees_buyback. |

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

This is not investment advice.

## About this repository

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. Everything in this repository is that work: the script, the snapshot, the model, the dashboard and this thesis. The first commit is dated 2026-10-30.

The vet402 export is public data under CC BY 4.0, cited above by URL and sha256. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`).
