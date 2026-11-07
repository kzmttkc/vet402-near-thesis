# How to check the pre-registration

`PREREG.md` is `THESIS.md` at commit `f0c48d13ed5af6147daa0e7a0b444855f3186770`, byte for byte. It is the text that was posted. It is not the thesis as it stands now.

## The post

- URL: https://near.social/smartbread5934.near/post/1794046390265
- Transaction: `BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB`
- Signer: `smartbread5934.near`
- Receiver: `social`
- Method: `__fastdata_kv`
- Block: `223452268` (block hash `BkKZAbq3WTfPmfupcySza3MUsA1UqQam2DUdryfd74dV`), 2026-11-07T10:13:11Z

```
shasum -a 256 PREREG.md
```

The digest is `d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec`.

The same digest and the commit are in the arguments of that transaction. Read them with no key:

```
curl -s https://rpc.mainnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"1","method":"tx","params":["BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB","smartbread5934.near"]}'
```

The arguments are base64. Decoded, they are one JSON object whose key is `post/1794046390265`. The text names commit `f0c48d13ed5af6147daa0e7a0b444855f3186770` and sha256 `d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec`.

## Why an explorer shows Failure

The transaction status is `Failure`. The error is `FunctionCallError`, `CompilationError`, `CodeDoesNotExist`, for the account `social`. That account has no contract, so the method `__fastdata_kv` does not exist, and the call fails.

The arguments stay in the transaction. FastNEAR's indexer walks function-call actions whose method name starts with `__fastdata_` and stores those arguments. The indexer does not check whether the call succeeded. Source: [main-indexer/src/main.rs](https://github.com/fastnear/fastdata-indexer/blob/main/main-indexer/src/main.rs) (`FASTDATA_PREFIX`, the loop over `ActionView::FunctionCall`). The key-value call shape is in [kv-sub-indexer/src/scylla_types.rs](https://github.com/fastnear/fastdata-indexer/blob/main/kv-sub-indexer/src/scylla_types.rs), in the comment `__fastdata_kv({ ... })`.

A view call `get` on the SocialDB contract `social.near`, for the key `smartbread5934.near/post/1794046390265`, returned `{}` on 2026-11-07. The write was a call to the account `social`, not a `set` on `social.near`.

## The line does not depend on NEAR

The line is the next whole number above 1% of the Base x402 count. That count is 2,539,947 payments, frozen in `data/snapshot/x402scan/base.json`, sha256 `9bc61df7abfbbb3f96b511503ce2d52481118b4b34cbdbc414afc4c1671fa55e`, retrieved `2026-10-29T23:18:32Z`. The file was already in this repository on 2026-10-30. 1% of 2,539,947 is 25,399.47, so the line is 25,400. The line is a function of that Base file. It does not move when NEAR data is fetched.

## When the post happened

The NEAR post at 2026-11-07 10:13 UTC is before the full-count fetch and after the NEAR sample fetch (2026-11-07 04:24 to 05:28 UTC).

- Commit `f0c48d1` is dated 2026-11-07T03:35:44Z (09:05:44+05:30) in this checkout. That stamp is earlier than the NEAR snapshot. The commit is tagged `prereg-threshold`. In a checkout that has the tag, `git show prereg-threshold:THESIS.md | shasum -a 256` prints `d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec`. That is the digest of `PREREG.md` and the digest in the transaction arguments. The on-chain post is what a third party can read while this repository is private. After publication, the same `git show` command is the check.
- `data/snapshot/near/manifest.json` records `retrieved_at` `2026-11-07T04:24:35.741Z` and `finished_at` `2026-11-07T05:28:36.141Z`. The sample estimate comes from that snapshot.
- Block 223452268 is 2026-11-07T10:13:11Z. That is after the sample, and `data/snapshot/near/relay-census.json` is still absent. The post's own text says it was registered before the full count.

## Words that changed after the post

`PREREG.md` holds the threshold section as posted. Later commits changed some sentences in "What would change my mind". The rule is the same. N is still the same five conditions. The line is still 25,400. A count at or above the line still crosses. A finished count below the line still does not. A partial count still crosses only when it is already at the line, and otherwise stays "not decided".

The differences:

1. `node thesis.mjs --fetch-near` became `node thesis.mjs --fetch-relays`. The flag name changed. `--fetch-relays` is a lower bound of accounts whose names are known. It is not a full public count of N. It still needs no key, and it still counts each transaction once.
2. "1% is 25,399.47, so the line is **25,400**" became "The line is the next whole number above 1% of that count, **25,400**". Same line. `Math.floor(2539947 / 100) + 1` is 25,400.
3. A stray fragment `, in f0c48d1` was inserted under the heading and then deleted. It was not part of the rule.
4. Two sentences were added. They say `relay-census.json` is not frozen, so the sample estimate is not N, and that `--offline` prints `full count not yet fetched` while that file is absent. The printed words were first a Japanese phrase for a full count not yet fetched, and are now the English `full count not yet fetched`. Neither sentence moves the line or the definition of N.
5. The posted sentence said the lower bound is "the payments through the one known x402 facilitator relayer". The current sentence says the lower bound is the sum of the known relay accounts, the named facilitators plus the generic signer whose name this survey already had. That definition of the lower bound changed after the post. The rule and the line did not.

The claim and the evidence in the current `THESIS.md` were written after `f0c48d1`. `PREREG.md` leaves those sections as "(Written after the data.)". They are not part of the posted text.
