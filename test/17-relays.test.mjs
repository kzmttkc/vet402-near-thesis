import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { main } from "../thesis.mjs";
import { loadNear } from "../lib/sources/near.mjs";
import {
  buildRelayCensus,
  censusAccount,
  hourHistogram,
  isListCandidate,
  judgeBounds,
  makeNearblocks,
  matchDelegateUsdc,
  matchRpcTx,
  nsFromIso,
  scatteredInstants,
  signerFromDetail,
  signerFromFrozenTx,
  signersFromFrozenSample,
  summarizeCensus,
} from "../lib/sources/relay-census.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

test("bounds cross, miss, or stay undecided", () => {
  assert.equal(judgeBounds({ lower: 25_400, upper: 42_675, line: 25_400 }), "crossed");
  assert.equal(judgeBounds({ lower: 10, upper: 20_421, line: 25_400 }), "not_crossed");
  assert.equal(judgeBounds({ lower: 10, upper: 42_675, line: 25_400 }), "not_decided");
});

test("scattered instants cover the window and are not piled on 16:2x UTC", () => {
  const from = "2026-10-08T04:24:35.741Z";
  const to = "2026-11-07T04:24:35.741Z";
  const instants = scatteredInstants(from, to, 30);
  assert.equal(instants.length, 30);
  for (const iso of instants) {
    assert.ok(iso >= from && iso <= to, iso);
    const minute = Number(iso.slice(14, 16));
    if (iso.slice(11, 13) === "16") assert.ok(minute < 20 || minute > 29, iso);
  }
  const hours = hourHistogram(instants).split(" ");
  const counts = hours.map((item) => Number(item.slice(3)));
  assert.ok(counts.filter((n) => n > 0).length >= 20);
  assert.ok(Math.max(...counts) <= 3);
  assert.ok(!instants.every((iso) => iso.slice(11, 15) === "16:2"));
});

test("only one successful inner ft_transfer to NEAR USDC counts", () => {
  const tree = {
    predecessor_account_id: "relayer",
    receiver_account_id: "payer",
    actions: [
      { action: "DELEGATE_ACTION", method: null },
      { action: "FUNCTION_CALL", method: "ft_transfer" },
    ],
    outcome: { status: true },
    receipts: [
      {
        predecessor_account_id: "payer",
        receiver_account_id: USDC,
        actions: [{ action: "FUNCTION_CALL", method: "ft_transfer" }],
        outcome: { status: true },
      },
    ],
  };
  assert.deepEqual(matchDelegateUsdc(tree, "relayer", USDC), { ok: true, reason: "counted" });
  const other = structuredClone(tree);
  other.receipts[0].receiver_account_id = "wrap.near";
  assert.equal(matchDelegateUsdc(other, "relayer", USDC).reason, "no_usdc_ft");
  const failed = structuredClone(tree);
  failed.receipts[0].outcome.status = false;
  assert.equal(matchDelegateUsdc(failed, "relayer", USDC).reason, "inner_failed");
  assert.equal(isListCandidate({ actions: tree.actions }), true);
  assert.equal(isListCandidate({ actions: [{ action: "DELEGATE_ACTION", method: null }] }), true);
  assert.equal(
    isListCandidate({
      actions: [
        { action: "DELEGATE_ACTION", method: null },
        { action: "FUNCTION_CALL", method: "ft_transfer_call" },
      ],
    }),
    false,
  );
});

test("detail and frozen tx both name the relayer only for one USDC ft_transfer", () => {
  const detail = {
    signer_account_id: "relayer",
    outcomes: { status: true },
    actions: [
      { action: "DELEGATE_ACTION", method: null, args: { receiver_id: USDC } },
      { action: "FUNCTION_CALL", method: "ft_transfer" },
    ],
  };
  assert.equal(signerFromDetail(detail, USDC), "relayer");
  detail.actions[0].args.receiver_id = "wrap.near";
  assert.equal(signerFromDetail(detail, USDC), null);
  const lone = {
    signer_account_id: "relayer",
    outcomes: { status: true },
    actions: [{ action: "DELEGATE_ACTION", method: null, args: { receiver_id: USDC, actions: [{ method_name: "ft_transfer" }] } }],
  };
  assert.equal(signerFromDetail(lone, USDC), "relayer");
  lone.actions[0].args.actions = [{ method_name: "ft_transfer_call" }];
  assert.equal(signerFromDetail(lone, USDC), null);
  assert.equal(
    signerFromFrozenTx({
      signer_id: "relayer",
      actions: [{ type: "Delegate", receiver_id: USDC, inner: [{ type: "FunctionCall", method_name: "ft_transfer" }] }],
    }),
    "relayer",
  );
  assert.equal(
    matchRpcTx(
      {
        transaction: {
          signer_id: "relayer",
          actions: [
            {
              Delegate: {
                delegate_action: {
                  receiver_id: USDC,
                  actions: [{ FunctionCall: { method_name: "ft_transfer" } }],
                },
              },
            },
          ],
        },
        receipts_outcome: [{ outcome: { executor_id: USDC, status: { SuccessValue: "" } } }],
      },
      USDC,
    ).ok,
    true,
  );
  assert.equal(
    matchRpcTx(
      {
        transaction: {
          signer_id: "other",
          actions: [
            {
              Delegate: {
                delegate_action: {
                  receiver_id: USDC,
                  actions: [{ FunctionCall: { method_name: "ft_transfer" } }],
                },
              },
            },
          ],
        },
        receipts_outcome: [{ outcome: { executor_id: USDC, status: { SuccessValue: "" } } }],
      },
      USDC,
      "relayer",
    ).ok,
    false,
  );
});

test("the frozen delegate sample has one relayer signer", async () => {
  const sample = JSON.parse(await readFile(join(ROOT, "data/snapshot/near/usdc-delegate-sample.json"), "utf8"));
  const signers = signersFromFrozenSample(sample);
  assert.equal(signers.length, 1);
  assert.equal(signers[0], "5a95b79bab56cbd3a338f616e4d6752dc23602242dd35338b57ee9e4ceb2364c");
});

test("a census whose sum disagrees is refused", () => {
  assert.throws(
    () =>
      summarizeCensus({
        lower: 2,
        upper: 10,
        result: "not_decided",
        accounts: [{ delegate_usdc: 1 }],
      }),
    /lower/,
  );
});

test("a lone DELEGATE_ACTION on the txn list is opened and counted", async () => {
  const account = "relayer.test";
  const window = { from: "2026-10-08T04:24:35.741Z", to: "2026-11-07T04:24:35.741Z" };
  const at = "2026-10-20T12:00:00.000Z";
  const lone = {
    transaction_hash: "h-lone",
    signer_account_id: account,
    block_timestamp: String(nsFromIso(at)),
    actions: [{ action: "DELEGATE_ACTION", method: null }],
  };
  const expanded = {
    transaction_hash: "h-pair",
    signer_account_id: account,
    block_timestamp: String(nsFromIso(at)),
    actions: [
      { action: "DELEGATE_ACTION", method: null },
      { action: "FUNCTION_CALL", method: "ft_transfer" },
    ],
  };
  const other = {
    transaction_hash: "h-call",
    signer_account_id: account,
    block_timestamp: String(nsFromIso(at)),
    actions: [
      { action: "DELEGATE_ACTION", method: null },
      { action: "FUNCTION_CALL", method: "ft_transfer_call" },
    ],
  };
  const get = async (url) => {
    if (url.includes(`/accounts/${account}/txns`)) return { data: [lone, expanded, other], meta: {} };
    throw new Error(`unexpected ${url}`);
  };
  const rpcOk = {
    transaction: {
      signer_id: account,
      actions: [
        {
          Delegate: {
            delegate_action: {
              receiver_id: USDC,
              actions: [{ FunctionCall: { method_name: "ft_transfer" } }],
            },
          },
        },
      ],
    },
    receipts_outcome: [{ outcome: { executor_id: USDC, status: { SuccessValue: "" } } }],
  };
  const rpc = async (hash) => (hash === "h-call" ? { result: { transaction: { signer_id: account, actions: [] } } } : { result: rpcOk });
  const row = await censusAccount(get, rpc, account, window, { log: () => {} });
  assert.equal(row.candidates, 2);
  assert.equal(row.delegate_usdc, 2);
  assert.equal(row.complete, true);
  assert.deepEqual(row.hashes, ["h-lone", "h-pair"]);
});

test("a census resumes from its progress file", async () => {
  const account = "relayer.test";
  const window = { from: "2026-10-08T04:24:35.741Z", to: "2026-11-07T04:24:35.741Z" };
  const dir = await mkdtemp(join(tmpdir(), "relay-census-"));
  const progressPath = join(dir, "progress.json");
  let lists = 0;
  const get = async (url) => {
    if (url.includes("method=ft_transfer")) return { data: [] };
    if (url.includes(`/accounts/${account}/txns`)) {
      lists += 1;
      return {
        data: [
          {
            transaction_hash: "h1",
            signer_account_id: account,
            block_timestamp: String(nsFromIso("2026-10-20T12:00:00.000Z")),
            actions: [{ action: "DELEGATE_ACTION", method: null }],
          },
        ],
        meta: {},
      };
    }
    if (url.includes("/txns/h1/receipts")) {
      return {
        data: {
          receipts: [
            {
              predecessor_account_id: "payer",
              receiver_account_id: USDC,
              actions: [{ action: "FUNCTION_CALL", method: "ft_transfer" }],
              outcome: { status: true },
            },
          ],
        },
      };
    }
    throw new Error(`unexpected ${url}`);
  };
  const rpc = async () => ({ error: "rpc down" });
  const opts = {
    get,
    rpc,
    window,
    upper: 42_675,
    estimate: 20_420.81111111111,
    line: 25_400,
    extraSigners: [account],
    points: 2,
    perPoint: 1,
    log: () => {},
    progressPath,
  };
  try {
    const first = await buildRelayCensus(opts);
    assert.equal(first.lower, 1);
    assert.equal(first.result, "not_decided");
    assert.equal(first.list_complete, true);
    assert.equal(lists, 1);
    const saved = JSON.parse(await readFile(progressPath, "utf8"));
    assert.equal(saved.rows.length, 1);
    const second = await buildRelayCensus(opts);
    assert.equal(lists, 1);
    assert.equal(second.lower, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("HTTP 429 widens the pause before the next try", async () => {
  const slept = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { status: 429, ok: false, json: async () => ({}) };
    return { status: 200, ok: true, json: async () => ({ data: [] }) };
  };
  const client = makeNearblocks({
    fetchImpl,
    pauseMs: 2500,
    log: () => {},
    sleepImpl: async (ms) => {
      slept.push(ms);
    },
  });
  const body = await client.get("https://api.nearblocks.io/v3/example");
  assert.deepEqual(body, { data: [] });
  assert.ok(slept.some((ms) => ms >= 8_000));
});

test("--fetch-relays cannot run with --offline", async () => {
  await assert.rejects(main(["--fetch-relays", "--offline"]), /cannot --fetch-relays with --offline/);
});

test("the frozen snapshot has no full relay count yet", async () => {
  const loaded = await loadNear(join(ROOT, "data/snapshot/near"));
  assert.equal(loaded.relaysPending, true);
  assert.equal(loaded.near.relays.pending, true);
  assert.equal(loaded.numbers["near.relays.lower"], undefined);
  assert.equal(loaded.numbers["near.known.lower"].value, 1716);
  assert.equal(loaded.numbers["near.known.named_delegate"].value, 0);
  assert.equal(loaded.numbers["near.known.uvd_signer_txs"].value, 51);
  assert.equal(loaded.numbers["near.known.uvd_delegate"].value, 0);
  assert.equal(loaded.numbers["near.known.generic_delegate"].value, 1716);
  assert.equal(loaded.near.known.roster.length, 5);
  assert.equal(loaded.near.known.roster.filter((row) => row.named_in_supported).length, 3);
  const generic = loaded.near.known.roster.find((row) => row.kind === "sample_signer");
  assert.equal(generic.named_in_supported, false);
  assert.equal(generic.delegate_usdc, 1716);
  assert.equal(loaded.near.known.reading, "not decided");
  assert.equal(loaded.near.known.line, 25400);
  assert.equal(loaded.numbers["near.spec.settlement_sentence"].value, 1);
  assert.ok(loaded.numbers["near.delegate.estimate"].value > 20_000);
  assert.match(loaded.numbers["near.delegate.estimate"].definition, /16:24/);
});
