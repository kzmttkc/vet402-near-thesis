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

The snapshot behind this page: vet402 export sha256 `{{snapshot.sha256}}`, retrieved {{snapshot.retrieved_at}}.

## Terms

{{definitions.table}}

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements. They are not demand, and vet402 labels them as tests in its own export.

## 1. Where agent payments settle

In the latest 30 days on x402scan (retrieved {{asof:x402.total.amount_30d}} UTC), x402 moved {{n:x402.total.amount_30d}} across all chains. Base carried {{n:x402.base.share_amount_30d}} of the dollars and {{n:x402.base.share_count_30d}} of the payments.

Visa and Artemis reach the same place on a longer window. Their report says Base carries "the vast majority of transaction volume" (data as of April 21, 2026, quote `visa_artemis.base` below).

So NEAR is not where agent payments settle today. This thesis does not depend on that changing.

## 2. Paying is not the whole job

vet402 paid real x402 sellers {{range:vet402.attempts}} UTC. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled on chain and {{n:vet402.delivered}} of those came back with an HTTP 2xx answer ({{n:vet402.delivered_share}} of settled).

The gap is not all the sellers' fault. {{n:vet402.held}} settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out. After that, {{n:vet402.unexplained}} settled purchases ({{n:vet402.unexplained_share_excl_held}}) paid and got nothing usable back, with no explanation in the record.

Every row lands in exactly one group. An unknown status stops the script instead of falling into "other".

{{breakdown.table}}

The settlements themselves hold up. I rechecked {{n:recheck.base.checked}} Base and {{n:recheck.solana.checked}} Solana settlements from this export against public RPCs: {{n:recheck.base.match}} and {{n:recheck.solana.match}} matched. Other chains are not rechecked.

A person who lets an agent spend has no easy way to see the gap. The agent paid. Whether the answer arrived is a separate question, and nobody records it for them. Illia Polosukhin points at the same need from the NEAR side: a verifiable audit link for each payment (quote `illia.audit_link`).

## 3. NEAR already moves money around payments

NEAR Intents moved {{n:intents.volume_30d|M}} in its latest 30 days on DefiLlama (retrieved {{asof:intents.volume_30d}} UTC). The need shows up on the user side too. Eddy Lazzarin wrote that one balance in his wallet pays to and from almost any chain (quote `eddy.any_chain`). His post does not mention NEAR, so it shows demand for the layer, not a win for NEAR.

On Base alone, the NEAR Intents treasury sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers over {{range:vault.usdc_out_30d.usd}}. That is all purposes, not only payments. It is a separate flow from x402 and appears here only for scale: about {{n:compare.vault_over_x402_base_30d}} times the x402 dollars on Base in a similar 30 days.

NEAR Foundation says the same thing in its own words (quote `near_blog.around_payment`): an agent pays through x402 and relies on NEAR for everything around that payment.

## 4. The model

Today x402 is {{model.ratio}} of NEAR Intents volume over 30 days. At today's size, x402 does almost nothing for NEAR. The table asks what it would take.

Each cell is a yearly amount that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents. It uses NEAR's own figures: a fee rate of {{model.fee_rate}} (cumulative fees over cumulative volume) and NEAR's share of those fees (quotes `near_q3.fees_buyback` and `near_q3.capture`). The report gives floors, so the model uses floors.

{{model.table}}

Even the largest cell, 1000 times today's x402 volume with half of it passing through NEAR, is smaller than what NEAR has already captured for buybacks (quote `near_q3.fees_buyback`). The value in this thesis is not x402 fees. It is that the services around an agent payment (funding, cross-chain movement, a record that the money bought something) are a better fit for NEAR than settlement is.

## 5. Arguments against

Settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" (quote `near_blog.settlement`). With Base at {{n:x402.base.share_amount_30d}} of x402 dollars, the numbers here do not support that path today.

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

{{quotes.table}}

## Disclosure

Since September 2019, before NEAR mainnet, I was a NEAR Ambassador and founded and ran NEAR Japan for about a year, as one of the top five contributors globally, and received nearly 20,000 NEAR from NEAR Foundation for that work. I later left after a formal contract with Solana Foundation.

This is not investment advice.

## About this repository

vet402 is an existing product that buys from x402 sellers on several chains and publishes every attempt. This repository is new work for NEAR HACKATHON: the script, the snapshot, the model, the dashboard and this thesis. The vet402 export is public data under CC BY 4.0, cited by URL and sha256. The derived copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here.
