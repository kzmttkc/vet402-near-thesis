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

The vet402 export behind this page has sha256 `{{snapshot.sha256}}` and was retrieved {{snapshot.retrieved_at}}.

## Terms

{{definitions.table}}

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements, not demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

In the latest 30 days on x402scan (retrieved {{asof:x402.total.amount_30d}} UTC), x402 moved {{n:x402.total.amount_30d}} across all chains. Base carried {{n:x402.base.share_amount_30d}} of the dollars and {{n:x402.base.share_count_30d}} of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`).

NEAR carries almost none of today's x402 settlement. The thesis below starts from that fact.

## 2. A payment and a delivered answer are two different records

vet402 paid x402 sellers {{range:vet402.attempts}} UTC. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled. For {{n:vet402.settled_no_tx}} of those, all on Arc mainnet (eip155:5042), the export has no transaction hash. Of the settled purchases, {{n:vet402.delivered}} came back with an HTTP 2xx answer ({{n:vet402.delivered_share}}).

{{n:vet402.held}} settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out of its own rates. Of the {{n:vet402.settled_not_held}} settled purchases left, {{n:vet402.unexplained}} ({{n:vet402.unexplained_share_excl_held}}) paid and got no usable answer, with no explanation in the record.

Every row lands in exactly one group. An unknown status stops the script instead of falling into "other".

{{breakdown.table}}

I rechecked {{n:recheck.base.checked}} Base and {{n:recheck.solana.checked}} Solana settlements from this export against public RPCs. On Base, {{n:recheck.base.match}} receipts succeeded and carry a USDC transfer of exactly the purchase amount. On Solana, {{n:recheck.solana.match}} transactions succeeded and credit one USDC account with exactly that amount. The recheck does not compare the payee with the seller, because the export does not list the payee. Other chains are not rechecked.

vet402 records whether each answer arrived for its own purchases. In the sources I checked, I found no such record kept for the person who funds an agent. Illia Polosukhin describes a verifiable audit link for each payment (quote `illia.audit_link`). That covers the payer's books, which is one part of the same record.

## 3. NEAR already moves money around payments

NEAR Intents moved {{n:intents.volume_30d|M}} in its latest 30 days on DefiLlama (retrieved {{asof:intents.volume_30d}} UTC).

NEAR Intents lists `0x2CfF890f0378a11913B6129B2E97417a2c302680` as its treasury address on EVM chains, Base included (quote `near_intents.treasury`). On Base, over {{range:vault.usdc_out_30d.usd}}, that address sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers. The transfers carry no label, so this counts every purpose, not only payments. It is a separate flow from x402. For scale only, it is about {{n:compare.vault_over_x402_base_30d}} times the x402 dollars on Base over a similar 30 days.

NEAR Foundation states the same aim (quote `near_blog.around_payment`): an agent pays through x402 and relies on NEAR for everything around that payment. Eddy Lazzarin wrote that one balance in his wallet pays to and from almost any chain (quote `eddy.any_chain`). His post is about a wallet that does not mention NEAR. I read it as a sign that people want this layer, not as evidence for NEAR.

## 4. The model

Today x402 is {{model.ratio}} of NEAR Intents volume over 30 days. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

Each cell is a yearly amount that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is {{model.fee_rate}}, cumulative fees over cumulative volume, and NEAR keeps its reported share of those fees (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

{{model.table}}

The largest cell is a yearly figure. For comparison, NEAR captured over $8 million for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). So x402 fees alone stay small next to what NEAR Intents already earns.

My opinion, which this data does not test: the services around an agent payment, funding and cross-chain movement and a record of what arrived, fit NEAR better than settlement does.

## 5. Arguments against

Settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). With Base at {{n:x402.base.share_amount_30d}} of x402 dollars, the numbers here do not support that path today.

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

{{quotes.table}}

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

This is not investment advice.

## About this repository

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. Everything in this repository is that work: the script, the snapshot, the model, the dashboard and this thesis. The first commit is dated 2026-10-30.

The vet402 export is public data under CC BY 4.0, cited above by URL and sha256. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`).
