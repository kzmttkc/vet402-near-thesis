// Read the pre-registration transaction from the public NEAR RPC.
// No key, no account, no mainnet write. npm test does not run online/.

// The transaction is older than a regular node keeps, so the read goes to archival nodes.
const RPCS = ["https://archival-rpc.mainnet.near.org", "https://archival-rpc.mainnet.fastnear.com"];
const TX = "BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB";
const SIGNER = "smartbread5934.near";

function statusName(status) {
  if (!status || typeof status !== "object") return "absent";
  return Object.keys(status)[0] ?? "absent";
}

async function rpcAt(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result;
}

let used = RPCS[0];

async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const result = await rpcAt(url, method, params);
      used = url;
      return result;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

const retrievedAt = new Date().toISOString();
const result = await rpc("tx", [TX, SIGNER]);
const tx = result?.transaction ?? {};
const call = (tx.actions ?? []).map((action) => action?.FunctionCall).find(Boolean);
if (!call) throw new Error("transaction has no function call");
const decoded = Buffer.from(call.args, "base64").toString("utf8");
const commit = decoded.match(/[0-9a-f]{40}/)?.[0] ?? "";
const digest = decoded.match(/[0-9a-f]{64}/)?.[0] ?? "";
if (!commit || !digest) throw new Error("decoded arguments do not name a commit and a digest");
const blockHash = result?.transaction_outcome?.block_hash ?? "";
let blockHeight = "";
let blockTime = "";
if (blockHash) {
  const block = await rpc("block", { block_id: blockHash });
  const header = block?.header ?? {};
  blockHeight = header.height ?? "";
  if (header.timestamp != null) {
    blockTime = new Date(Number(BigInt(header.timestamp) / 1_000_000n)).toISOString();
  }
}

console.log(`retrieved_at ${retrievedAt}`);
console.log(`endpoint ${used}`);
console.log(`method tx`);
console.log(`tx ${TX}`);
console.log(`signer ${tx.signer_id ?? ""}`);
console.log(`receiver ${tx.receiver_id ?? ""}`);
console.log(`call ${call.method_name}`);
console.log(`status ${statusName(result.status)}`);
console.log(`block_hash ${blockHash}`);
console.log(`block_height ${blockHeight}`);
console.log(`block_time ${blockTime}`);
console.log(`commit ${commit}`);
console.log(`sha256 ${digest}`);
