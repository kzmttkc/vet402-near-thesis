# NEAR in agent payments: a thesis you can rerun

NEAR's edge in agent payments is the funding and settlement layer: NEAR Intents already settles cross-chain agent payments, and x402 has had a NEAR settlement spec since {{field:near.spec.pr_merged_at}} UTC that is ready but not yet lit. The argument, the evidence, and the number that would change my mind are in [THESIS.md](THESIS.md). Every figure about the market and about vet402 below comes from this repository, either from one script you can rerun without a key or an account, or from a quote in the table at the end.

## What changed in this version

- x402 on NEAR could not be measured from x402scan. The settlement spec is present, and the payments this page can point at are close to zero.
- The threshold was committed before the NEAR data, in commit f0c48d1.
- [THESIS.md](THESIS.md) is new. It holds the claim, the evidence, and that threshold.

This is an entry for the NEAR HACKATHON track "Investment Thesis", which is judged on the evidence.

## Try it

Node 20 or newer. Nothing to install.

| Do this | See this |
|---|---|
| `node thesis.mjs --offline` | `rebuilt … numbers from data/snapshot (no network), 2 checks ok`. The numbers on this page, rebuilt from the frozen snapshot in `data/snapshot/`. It rewrites `data/thesis.json`, and only `generated_at` changes. |
| `node thesis.mjs --offline` | NEAR from that same frozen snapshot, with no network: the settlement spec is present ({{n:near.spec.settlement_sentence}}), the opt-in catalog lists {{n:near.facilitator.discovery_total}} resources, the named relayer has {{n:near.relayer.payments}} payments, and N's line is {{n:threshold.line}} with a sample estimate of {{n:near.delegate.estimate}} and a 95% upper bound of {{n:near.delegate.estimate_upper_95}}. Stdout is one line and ends with `全数は未取得` while `relay-census.json` is absent. |
| `node thesis.mjs --fetch-relays` | The full 30-day relayer count. It takes a long time, waits out HTTP 429 by widening the gap, and resumes from `data/snapshot/near/relay-census.progress.json`. |
| `node thesis.mjs --check README.md` | `mismatches: 0`. The script builds this page again from `README.tmpl.md` and `data/thesis.json` and compares it line by line, so an edited figure on this page shows up as a mismatch. Figures typed into the template itself are not covered by this check. The quotes cover them. |
| `node thesis.mjs --check-quotes` | `missing: 0`. Each quote below is fetched again and found word for word. Web pages are read directly, X posts through the public fxtwitter API, and the one PDF is reported as not machine-checked. |
| `node --test` | All tests pass in about a minute, including one that stops on an unknown purchase status and one that runs the offline build in a throwaway copy. |
| `node thesis.mjs` | A fresh fetch from the public sources. The figures move and the dates change. |
| `python3 -m http.server -d docs 8123`, then open http://localhost:8123 | The dashboard. The same numbers, each with its range, date and source, and a count of any figure missing one of them. |

The vet402 export behind this page has sha256 `{{snapshot.sha256}}` and was retrieved {{snapshot.retrieved_at}}. The derived copy in this repository, `data/snapshot/export.derived.csv`, has sha256 `{{snapshot.derived_sha256}}`.

## Terms

{{definitions.table}}

vet402 buys from x402 sellers with its own money to measure whether they deliver. These purchases are measurements and say nothing about demand. They are also vet402's own sample of sellers, with Base first, so they describe those sellers and not x402 as a whole.

## 1. Where agent payments settle

x402scan lists Base, Solana, Polygon and Optimism. Polygon and Optimism show zero in the latest 30 days, so the total below is Base plus Solana: {{n:x402.total.amount_30d}} of x402 payments (retrieved {{asof:x402.total.amount_30d}} UTC). Base carried {{n:x402.base.share_amount_30d}} of the dollars and {{n:x402.base.share_count_30d}} of the payments.

Visa and Artemis Analytics describe a longer window the same way: Base carries "the vast majority of transaction volume", with data as of April 21, 2026 (quote `visa_artemis.base`). The report calls the figures in its section 1 raw onchain totals and gives adjusted figures without wash and test transactions elsewhere. Section 3.3 does not say which kind it uses. Nothing here is adjusted.

x402scan's chain filter accepts only those four chains (its answer to a NEAR filter is saved in `data/snapshot/x402scan/near-rejected.json`), so this repository cannot measure x402 settlement on NEAR, and no source here shows any. I treat Base as where agent payments settle today.

## 2. A payment and a delivered answer are two different records

vet402 tried to buy from x402 sellers {{range:vet402.attempts}} UTC. Of {{n:vet402.attempts}} attempts, {{n:vet402.settled}} settled. For {{n:vet402.settled_no_tx}} of those, all on Arc mainnet (eip155:5042), the export has no transaction hash. For {{n:vet402.settled_seller_claim}} of the settled purchases, the export records the seller's claim as the evidence of settlement. The rechecks below cover samples of those on Base and Solana. Of the settled purchases, {{n:vet402.delivered}} came back with an HTTP 2xx answer ({{n:vet402.delivered_share}}).

{{n:vet402.held}} settled purchases got a 4xx answer that may come from how vet402 asked, so vet402 holds them out of its own rates. Of the {{n:vet402.settled_not_held}} settled purchases left, {{n:vet402.unexplained}} ({{n:vet402.unexplained_share_excl_held}}) paid and got no usable answer, with no explanation in the record.

Every row lands in exactly one group. An unknown status stops the script instead of falling into "other".

{{breakdown.table}}

I rechecked {{n:recheck.base.checked}} Base and {{n:recheck.solana.checked}} Solana settlements from this export against public RPCs. On Base, {{n:recheck.base.match}} receipts succeeded and carry a USDC transfer of exactly the purchase amount. On Solana, {{n:recheck.solana.match}} transactions succeeded and credit one USDC account with exactly that amount. The recheck does not compare the payee with the seller, because the export does not list the payee. Other chains are not rechecked.

vet402 records whether each answer arrived for its own purchases, and the gap above is what that record shows.

## 3. NEAR already moves money around payments

NEAR Intents moved {{n:intents.volume_30d|M}} in its latest 30 days on DefiLlama (retrieved {{asof:intents.volume_30d}} UTC).

NEAR Intents lists `0x2CfF890f0378a11913B6129B2E97417a2c302680` as its treasury address on EVM chains, Base included (quote `near_intents.treasury`). On Base, over {{range:vault.usdc_out_30d.usd}}, that address sent out {{n:vault.usdc_out_30d.usd|M}} of USDC in {{n:vault.usdc_out_30d.count}} transfers. The transfers carry no label, so this counts every purpose, and the data here cannot say how much of it, if any, is x402. For scale only, it is about {{n:compare.vault_over_x402_base_30d}} times the x402 dollars on Base over a similar 30 days.

NEAR Foundation names the same layer (quote `near_blog.around_payment`). Its stated intention is that an agent can pay through x402 and rely on NEAR infrastructure for everything around that payment. The same post also names settlement on NEAR Protocol, covered in section 5.

## 4. The model

Today x402 is {{model.ratio}} of NEAR Intents volume over 30 days. At this size, x402 adds almost nothing to NEAR. The table shows how large it would need to grow.

Each cell is a yearly amount, the 30-day x402 figure times 12, that would reach NEAR if x402 grew by the row's multiple and the column's share of it passed through NEAR Intents and paid its average fee. The fee rate is {{model.fee_rate}}, cumulative fees over cumulative volume, and NEAR keeps its reported lifetime share of those fees, {{model.input.take_rate}} (quotes `near_q3.fees_buyback`, `near_q3.cumulative` and `near_q3.capture`). The same report gives a trailing 30-day share of {{model.input.take_rate_trailing_30d}} (quote `near_q3.capture_30d`). Using it would raise every cell by about {{model.input.trailing_over_lifetime}} times. NEAR reports {{model.input.q3_intents_usd}} for Q3 (quote `near_q3.q3_volume`). DefiLlama's daily sum for the same quarter is {{model.q3_gap}} lower. The report gives both fees and volume as floors ("over"), so the rate is an estimate, not a bound. Whether x402 flows would pay the average Intents fee at all is an assumption the data here does not test.

{{model.table}}

The largest cell is a yearly figure. For comparison, NEAR captured over {{model.input.buyback_usd}} for buybacks in the seven months its fee switch has run (quotes `near_q3.fee_switch` and `near_q3.fees_buyback`). The largest cell stays below that buyback figure.

My opinion, which this data does not test: the services around an agent payment, funding and cross-chain movement and a record of what arrived, fit NEAR better than settlement does.

## 5. Arguments against

Settlement on NEAR itself. NEAR Foundation also names "scalable, quantum-resistant settlement through NEAR Protocol" as part of what it is building (quote `near_blog.settlement`). With Base at {{n:x402.base.share_amount_30d}} of x402 dollars, the numbers here do not support that path today.

## 6. What would change my mind

Rerun `node thesis.mjs` on the next 30-day window and compare.

- Base's share of x402 dollars on x402scan falls below half.
- USDC sent out of the NEAR Intents treasury on Base falls in each of the next three 30-day windows.
- In vet402's sample, the share of settled purchases with no usable answer falls close to zero, so a delivery record matters less.

## 7. What I watch

Each day the public counts are fetched again with no key, and the dashboard shows when they move toward the line of {{n:threshold.line}}.

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

vet402 is a product I run, and a finding that delivery records matter would help it.

This is not investment advice.

## About this repository

vet402 is an existing product. It has bought from x402 sellers on several chains since 2026-08-14 and publishes every attempt. Under the hackathon rules (Q-001 and Q-002 in https://nearhackathon.com/HACKATHON.md), only work inside the window that opened on 2026-10-19 is judged. The vet402 export starts on 2026-08-14 and is baseline data from before the window. The classification, the checks, the model, the dashboard and this thesis were written in the window. The first commit is dated 2026-10-30 (JST).

The export comes from https://vet402.com/api/v1/observatory/export.csv?days=365 under CC BY 4.0, and its sha256 is given at the top. The copy in `data/snapshot/` replaces every seller URL with its sha256, so no seller is named here. The code is under the MIT License (`LICENSE`). No third-party packages are used. The code was written with AI coding agents (Claude and Grok), then run and checked by me.
