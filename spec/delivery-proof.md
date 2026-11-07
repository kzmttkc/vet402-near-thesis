# Extension: delivery proof for `exact` on NEAR

This document is an extension proposal. It sits on top of the x402 v2 `exact` scheme for NEAR (`specs/schemes/exact/scheme_exact_near.md`). It does not change that scheme's settlement rules.

## Summary

After the facilitator reports that the inner `ft_transfer` receipt succeeded, the seller returns a delivery receipt inside the `SettlementResponse` carried by `PAYMENT-RESPONSE`. The receipt is an Ed25519 signature over the SHA-256 of the delivered bytes and the payment's nonce and transaction hash. The buyer hashes the bytes they received and checks the signature. If the hash differs, or the seller sends no receipt, the buyer can file that evidence with the facilitator. The filing is a record. It does not move tokens.

Implementations that still send the prefixed header put the same `SettlementResponse` JSON in `X-PAYMENT-RESPONSE`.

## Motivation

The NEAR `exact` scheme treats the inner `ft_transfer` receipt as the payment. A successful receipt does not name the bytes the resource server sent after settlement. The x402 offer-receipt extension (`specs/extensions/extension-offer-and-receipt.md`, main branch as fetched on 2026-11-07) lets a resource server return a signed receipt whose required payload is `version`, `network`, `resourceUrl`, `payer`, and `issuedAt`, with an optional `transaction`. That payload does not include a digest of the delivered body.

This extension adds that binding for NEAR `exact` payments. The payment identifier is the pair `(nonce, tx_hash)` already fixed by the signed delegate action and the settled transaction.

## Specification

### Versions

- `x402Version` remains `2`.
- The receipt payload `version` is `1`.
- `scheme` is `exact`.
- `network` is the CAIP-style NEAR network of the payment, `near:mainnet` or `near:testnet`.

### Placement

On success, `SettlementResponse` MAY include:

```json
{
  "success": true,
  "transaction": "<tx hash>",
  "network": "near:mainnet",
  "payer": "<buyer account>",
  "extensions": {
    "delivery-proof": {
      "info": {
        "receipt": {}
      }
    }
  }
}
```

`extensions["delivery-proof"].info.receipt` is the receipt object below. A response with `success: false` MUST NOT include a delivery receipt.

### Receipt payload

The signed payload is a JSON object with exactly these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | number | `1` |
| `scheme` | string | `exact` |
| `network` | string | CAIP-style NEAR network |
| `nonce` | string | Decimal access-key nonce from the buyer's signed delegate action |
| `tx_hash` | string | Hash of the settled outer transaction |
| `content_sha256` | string | Lowercase hex SHA-256 of the raw delivered bytes |
| `hash_alg` | string | `sha256` |

`content_sha256` is the SHA-256 of the response body octets the seller claims to have sent. It is not a hash of a parsed document, and it is not a hash of the headers.

### Canonical bytes and signature

Canonical bytes are the UTF-8 of `JSON.stringify` of the payload with the keys in this order and no extra whitespace:

`content_sha256`, `hash_alg`, `network`, `nonce`, `scheme`, `tx_hash`, `version`.

The signature is Ed25519 over those bytes. It is encoded as base64url with no padding. The receipt object is:

| Field | Type | Meaning |
| --- | --- | --- |
| `payload` | object | The payload above |
| `signer_public_key` | string | Raw 32-byte Ed25519 public key, base64url |
| `signature` | string | 64-byte Ed25519 signature, base64url |

The public key in the receipt is not an authority by itself. The buyer verifies the signature with the seller key it already trusts for that merchant.

### Buyer check

The buyer MUST:

1. Read the body octets it actually received and compute SHA-256.
2. Require `payload.nonce` and `payload.tx_hash` to equal the nonce it signed and the transaction hash from the successful settlement.
3. Verify the Ed25519 signature over the canonical payload bytes with the trusted seller key.
4. Require `payload.content_sha256` to equal the hash from step 1.

If step 3 fails, the receipt is not from the seller. If step 2 fails, the receipt belongs to a different payment. If step 4 fails, the signed hash is not the body the buyer holds.

### Missing receipt and dispute record

A missing `delivery-proof` extension is not a failed payment. The payment stands or falls on the inner `ft_transfer` receipt, as the NEAR `exact` scheme already says.

The buyer MAY submit a dispute record to the facilitator:

- The settlement `transaction` and `nonce`.
- The SHA-256 of the body the buyer holds.
- The receipt, if one was returned. Omit it when the seller sent none.

The facilitator MUST verify a presented receipt against the seller key and the settled payment before recording it. It MUST record one of `match`, `content_mismatch`, `payment_mismatch`, `bad_signature`, or `unanswered`. It MUST NOT submit a NEAR transaction, refund, or second `ft_transfer` as part of this record.

## Security considerations

- The seller chooses the bytes it hashes. A buyer that does not hash the body it received learns nothing from a valid signature.
- A receipt signed for one `(nonce, tx_hash)` does not verify for another. Replaying the receipt onto a second payment fails the payment binding.
- An altered signature, or a signature under a key other than the trusted seller key, fails verification.
- The facilitator record does not freeze the body on chain. Two buyers can file different hashes. The record shows what was filed and whether the signature matched.
- The hash does not hide the body from someone who already has it. It does not encrypt the response.
- Outer-transaction success is still not delivery, and it is still not inner-transfer success. This extension starts only after the NEAR `exact` settlement rules have already accepted the inner `ft_transfer`.

## Test vectors

Normative vectors, including the test signing seed, are in `lib/delivery-proof/vectors.json`. The seed is a test key, not a NEAR account key. The body for the valid case is the UTF-8 string `the delivered answer`. Its SHA-256 is `9cbc23193419eccbdb5a3a082a57bbe90e9eee51761cfab70cac4a367863c5c5`.

Valid receipt:

```json
{
  "payload": {
    "content_sha256": "9cbc23193419eccbdb5a3a082a57bbe90e9eee51761cfab70cac4a367863c5c5",
    "hash_alg": "sha256",
    "network": "near:mainnet",
    "nonce": "7",
    "scheme": "exact",
    "tx_hash": "F7p8QyW8tWnL1QhP9j8uV1q2rM5aZ6xC3e4kT9mN2pR",
    "version": 1
  },
  "signer_public_key": "ODBXeiSmBilDMvn64YlNIIsh0fcIa20yGQzXdZXqlMo",
  "signature": "lE1d3sfko6e274TKNcKdGRXa5HxII_x1DTeZev_wkvFZtvN7lUdENz2o14uOIUYY7gaKPK8TQnbyNoVxnFheAg"
}
```

| Vector | Expected reason |
| --- | --- |
| `valid` | `ok` |
| `content_tamper` | `content_mismatch` |
| `reused_on_other_payment` | `payment_mismatch` |
| `forged_signature` | `bad_signature` |

The reference implementation is `lib/delivery-proof/`. `verifyReceipt` returns `{ ok, reason }` and uses the reasons in the table.
