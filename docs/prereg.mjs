// Frozen record of the pre-registered post. The browser replay reads this.
// It does not call an RPC. test/23-prereg-replay.test.mjs checks every field
// against PREREG-VERIFY.md and the sha256 of PREREG.md.

export const PREREG_RECORD = Object.freeze({
  tx: "BbegySAyn8WSh8StsGBFxKKk4YDWzHSePyLtiH5k5vLB",
  signer: "smartbread5934.near",
  receiver: "social",
  method: "__fastdata_kv",
  block: 223452268,
  blockHash: "BkKZAbq3WTfPmfupcySza3MUsA1UqQam2DUdryfd74dV",
  at: "2026-11-07T10:13:11Z",
  commit: "f0c48d13ed5af6147daa0e7a0b444855f3186770",
  digest: "d8925b096c421dc12afc77fe2421a2ec29e96581f9b66d4273984178764c24ec",
  postKey: "post/1794046390265",
});

function pad(n) {
  return String(n).padStart(2, "0");
}

export function replayLabel(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "Replay";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Replay ${months[date.getUTCMonth()]} ${date.getUTCDate()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

// fileDigest is the sha256 of PREREG.md when this checkout could read the file.
// Null means the file was not loaded. Neither path contacts a chain.
export function replaySteps(record, fileDigest) {
  const posted = record.digest;
  let check;
  if (typeof fileDigest !== "string" || fileDigest === "") {
    check = "PREREG.md was not loaded beside this page. The posted digest stays on record. No RPC was called.";
  } else if (fileDigest === posted) {
    check = "sha256 of PREREG.md matches the posted digest.";
  } else {
    check = "sha256 of PREREG.md does not match the posted digest.";
  }
  return [
    "Replay of the frozen record. This page does not call an RPC.",
    `Transaction ${record.tx}. Signer ${record.signer}. Receiver ${record.receiver}. Method ${record.method}. Block ${record.block}. Block hash ${record.blockHash}. ${record.at}.`,
    `Arguments name commit ${record.commit} and sha256 ${posted}. Key ${record.postKey}.`,
    check,
  ];
}
