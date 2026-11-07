import { createServer } from "node:http";
import { verifyReceipt } from "../lib/delivery-proof/index.mjs";
import { settleExact, verifyExact } from "./exact.mjs";

// Local reference facilitator. /receipt records a delivery verdict and does not
// submit a transaction. startFacilitator refuses any RPC host other than 127.0.0.1.

const REASONS = new Set(["match", "content_mismatch", "payment_mismatch", "bad_signature", "unanswered"]);

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function supportedBody(relayerAccount, network) {
  return {
    kinds: [{ x402Version: 2, scheme: "exact", network }],
    extensions: ["payment-identifier", "delivery-proof"],
    signers: { [network]: [relayerAccount] },
  };
}

function publicSettle(result) {
  const body = {
    success: result.success,
    transaction: result.transaction,
    network: result.network,
  };
  if (result.payer) body.payer = result.payer;
  if (!result.success) body.errorReason = result.errorReason;
  return body;
}

function recordReceipt(body, byHash, disputes) {
  const row = byHash.get(body?.transaction);
  if (!row) return { status: 404, body: { recorded: false, reason: "unknown_settlement" } };
  let reason = "bad_signature";
  if (body.receipt == null) {
    reason = "unanswered";
  } else if (body.nonce != null && body.nonce !== row.nonce) {
    reason = "payment_mismatch";
  } else if (typeof body.seller_public_key === "string" && typeof body.content_sha256 === "string") {
    const verdict = verifyReceipt(body.receipt, {
      publicKey: body.seller_public_key,
      nonce: row.nonce,
      txHash: row.transaction,
      contentSha256: body.content_sha256,
    });
    reason = verdict.reason === "ok" ? "match" : verdict.reason;
  }
  if (!REASONS.has(reason)) reason = "bad_signature";
  const rec = { recorded: true, reason, transaction: row.transaction, nonce: row.nonce };
  disputes.push(rec);
  return { status: 200, body: rec };
}

export function startFacilitator({ rpcUrl, relayerAccount, network = "near:mainnet" }) {
  const host = new URL(rpcUrl).hostname;
  if (host !== "127.0.0.1") throw new Error("facilitator reference refuses a non-local RPC");
  const settling = new Set();
  const settled = new Map();
  const byHash = new Map();
  const disputes = [];
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (req.method === "GET" && path === "/supported") {
        send(res, 200, supportedBody(relayerAccount, network));
        return;
      }
      if (req.method !== "POST") {
        send(res, 404, { error: "not_found" });
        return;
      }
      const body = await readJson(req);
      if (path === "/verify") {
        const verdict = await verifyExact({
          paymentPayload: body.paymentPayload,
          paymentRequirements: body.paymentRequirements,
          rpcUrl,
          relayerAccount,
        });
        send(res, 200, verdict);
        return;
      }
      if (path === "/settle") {
        const result = await settleExact({
          paymentPayload: body.paymentPayload,
          paymentRequirements: body.paymentRequirements,
          rpcUrl,
          relayerAccount,
          settling,
          settled,
        });
        if (result.success) {
          byHash.set(result.transaction, {
            transaction: result.transaction,
            nonce: result.nonce,
            payer: result.payer,
            network: result.network,
          });
        }
        send(res, 200, publicSettle(result));
        return;
      }
      if (path === "/receipt") {
        const out = recordReceipt(body, byHash, disputes);
        send(res, out.status, out.body);
        return;
      }
      send(res, 404, { error: "not_found" });
    } catch {
      send(res, 400, { error: "bad_request" });
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        disputes,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
