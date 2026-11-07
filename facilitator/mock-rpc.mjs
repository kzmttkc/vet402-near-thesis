import { createServer } from "node:http";
import { canonicalDelegate, canonicalDelegateBytes } from "./exact.mjs";
import { ed25519Verify } from "../lib/delivery-proof/index.mjs";

// In-process stand-in for the NEAR JSON-RPC methods the exact scheme names.
// It listens on 127.0.0.1 only. It is not near-sandbox and it is not mainnet.

export const EMPTY_CODE_HASH = "11111111111111111111111111111111";

function jsonBytes(value) {
  return [...Buffer.from(JSON.stringify(value), "utf8")];
}

export function mockChainState({ height = 100, buyer, buyerKey, buyerBalance, asset, payTo }) {
  return {
    height,
    hash: `mock-block-${height}`,
    accounts: {
      [buyer]: {
        amount: "1000000000000000000000000",
        code_hash: EMPTY_CODE_HASH,
        keys: { [buyerKey]: { nonce: 1, permission: "FullAccess" } },
      },
      [asset]: {
        amount: "0",
        code_hash: "ab".repeat(16),
        keys: {},
        balances: { [buyer]: buyerBalance },
        storage: { [payTo]: { total: "1250000000000000000000", available: "0" } },
      },
      [payTo]: {
        amount: "1",
        code_hash: EMPTY_CODE_HASH,
        keys: {},
      },
    },
    txs: [],
  };
}

function reply(res, id, result, error) {
  const body = error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function handle(state, method, params) {
  if (method === "block") {
    if (params?.finality !== "final") return { error: { name: "BAD_FINALITY", message: "finality must be final" } };
    return { result: { header: { height: state.height, hash: state.hash } } };
  }
  if (method === "query") {
    if (params?.finality !== "final" || params.block_id !== state.hash) {
      return { error: { name: "BAD_BLOCK", message: "query is not pinned to the final block" } };
    }
    const account = state.accounts[params.account_id];
    if (!account) return { error: { name: "UNKNOWN_ACCOUNT", message: "account not found" } };
    if (params.request_type === "view_account") {
      return { result: { amount: account.amount, code_hash: account.code_hash, block_height: state.height } };
    }
    if (params.request_type === "view_access_key") {
      const key = account.keys?.[params.public_key];
      if (!key) return { error: { name: "UNKNOWN_ACCESS_KEY", message: "access key not found" } };
      return { result: { nonce: key.nonce, permission: key.permission, block_height: state.height } };
    }
    if (params.request_type === "call_function") {
      let args;
      try {
        args = JSON.parse(Buffer.from(params.args_base64, "base64").toString("utf8"));
      } catch {
        return { error: { name: "BAD_ARGS", message: "args_base64 is not json" } };
      }
      if (params.method_name === "ft_balance_of") {
        return { result: { result: jsonBytes(account.balances?.[args.account_id] ?? "0"), block_height: state.height } };
      }
      if (params.method_name === "storage_balance_of") {
        return { result: { result: jsonBytes(account.storage?.[args.account_id] ?? null), block_height: state.height } };
      }
      return { error: { name: "METHOD_NOT_FOUND", message: "method not found" } };
    }
    return { error: { name: "BAD_REQUEST", message: "request_type is not supported" } };
  }
  if (method === "broadcast_tx_commit") {
    const delegate = canonicalDelegate(params?.delegate_action);
    const bytes = delegate && canonicalDelegateBytes(delegate);
    if (!delegate || !bytes) return { error: { name: "BAD_DELEGATE", message: "delegate action is not the exact shape" } };
    if (!ed25519Verify(params.public_key, bytes, params.signature)) {
      return { error: { name: "INVALID_SIGNATURE", message: "delegate signature failed" } };
    }
    const signer = state.accounts[delegate.sender_id];
    const key = signer?.keys?.[delegate.public_key];
    if (!key) return { error: { name: "UNKNOWN_ACCESS_KEY", message: "access key not found" } };
    if (BigInt(delegate.nonce) <= BigInt(key.nonce)) {
      return { error: { name: "DelegateActionInvalidNonce", message: "nonce already used" } };
    }
    const asset = state.accounts[delegate.receiver_id];
    const amount = BigInt(delegate.actions[0].args.amount);
    const balance = BigInt(asset?.balances?.[delegate.sender_id] ?? "0");
    if (!asset || balance < amount) {
      state.txs.push({ hash: null, ok: false });
      return {
        result: {
          transaction: { hash: "" },
          receipts_outcome: [{ outcome: { executor_id: delegate.receiver_id, status: { Failure: "insufficient" } } }],
        },
      };
    }
    asset.balances[delegate.sender_id] = (balance - amount).toString();
    key.nonce = Number(delegate.nonce);
    const hash = canonicalDelegateBytes(delegate).toString("hex").slice(0, 64);
    state.txs.push({ hash, ok: true, signer_id: params.signer_id });
    return {
      result: {
        transaction: { hash },
        receipts_outcome: [{ outcome: { executor_id: delegate.receiver_id, status: { SuccessValue: "" } } }],
      },
    };
  }
  return { error: { name: "METHOD_NOT_FOUND", message: `${method} is not implemented` } };
}

export function startMockRpc(state) {
  let requests = 0;
  const server = createServer(async (req, res) => {
    requests += 1;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      reply(res, null, null, { name: "PARSE_ERROR", message: "body is not json" });
      return;
    }
    const out = handle(state, body.method, body.params);
    reply(res, body.id, out.result, out.error);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        state,
        get requests() {
          return requests;
        },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
