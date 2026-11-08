// Rebuild docs/rerun.html from this checkout.
// The layout and the sentences stay fixed. The UTC clock, the short SHA,
// and each command's stdout are the parts that move.
// online/read-prereg-tx.mjs only queries the public RPC (tx, then block).
// If that read fails, this script exits and does not write the page.
// --offline rewrites generated_at. Those JSON files, and the two docs copies
// publishDashboardFiles refreshes, are restored and are not part of the record.
// Run: node scripts/record-rerun.mjs

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = join(root, "docs", "rerun.html");

// publishDashboardFiles copies the thesis JSON, PREREG.md, and facilitators.json.
const restored = [
  "data/thesis.json",
  "docs/thesis.json",
  "docs/PREREG.md",
  "docs/facilitators.json",
];

function childEnv() {
  const env = { ...process.env };
  // Both set makes Node warn on stderr, and FORCE_COLOR paints the test list.
  // The page says stderr was empty and shows the plain list.
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: childEnv(),
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.error ? `${result.error.message}\n` : (result.stderr ?? ""),
  };
}

function fail(message, result) {
  console.error(message);
  if (result) {
    console.error(`status ${result.status}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  console.error("docs/rerun.html was not written");
  throw new Error("stop");
}

function shortSha() {
  const result = run("git", ["rev-parse", "--short=7", "HEAD"]);
  const sha = result.stdout.trim();
  if (result.status !== 0 || !/^[0-9a-f]{7,40}$/.test(sha)) {
    fail("could not read the short commit SHA", result);
  }
  return sha;
}

function stamp(date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function escapeText(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function backupTree() {
  const dir = mkdtempSync(join(tmpdir(), "rerun-thesis-"));
  for (const rel of restored) {
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(root, rel), dest);
  }
  return dir;
}

function restoreTree(dir) {
  for (const rel of restored) copyFileSync(join(dir, rel), join(root, rel));
}

function accept(title, result) {
  if (result.status !== 0 || result.stderr.length > 0 || result.stdout.trim() === "") {
    fail(`${title} did not finish cleanly`, result);
  }
  return { title, stdout: result.stdout };
}

let started;
let sha;
let blocks;
try {
  started = new Date();
  sha = shortSha();
  blocks = [];

  blocks.push(accept("npm test", run("npm", ["test"])));
  if (!/^ℹ fail 0$/m.test(blocks[0].stdout)) {
    fail("npm test did not report fail 0", { status: 1, stdout: blocks[0].stdout, stderr: "" });
  }

  const backup = backupTree();
  try {
    blocks.push(accept("node thesis.mjs --offline", run(process.execPath, ["thesis.mjs", "--offline"])));
  } finally {
    restoreTree(backup);
  }

  blocks.push(accept("node thesis.mjs --check README.md", run(process.execPath, ["thesis.mjs", "--check", "README.md"])));
  blocks.push(accept("node thesis.mjs --check THESIS.md", run(process.execPath, ["thesis.mjs", "--check", "THESIS.md"])));

  const rpc = run(process.execPath, ["online/read-prereg-tx.mjs"]);
  if (rpc.status !== 0 || rpc.stderr.length > 0 || !rpc.stdout.includes("retrieved_at ")) {
    fail("the pre-registration read did not reach the RPC", rpc);
  }
  blocks.push({ title: "node online/read-prereg-tx.mjs", stdout: rpc.stdout });
} catch (err) {
  if (!err || err.message !== "stop") throw err;
  process.exit(1);
}

const recorded = `Recorded ${stamp(started)} (${sha}). Each block is the stdout of that command. stderr was empty.`;
const sections = blocks
  .map((block) => `    <h2>${escapeText(block.title)}</h2>\n    <pre>${escapeText(block.stdout)}</pre>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Re-execution record</title>
  <style>
    @font-face {
      font-family: "Martian Mono";
      src: url("./fonts/martian-600.woff2") format("woff2");
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "Fragment Mono";
      src: url("./fonts/fragment-400.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    :root {
      color-scheme: light;
      --paper: #ffffff;
      --hair: #dfe3e9;
      --navy: #233456;
      --slate: #55688c;
      --focus: #0891b2;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; overflow-x: hidden; }
    body {
      background: var(--paper);
      color: var(--navy);
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 1rem;
      font-weight: 400;
      line-height: 1.5;
    }
    main {
      width: min(72rem, 100%);
      margin: 0 auto;
      padding: 28px 16px 64px;
    }
    h1, h2 {
      font-family: "Martian Mono", ui-monospace, monospace;
      font-weight: 600;
      color: var(--navy);
    }
    h1 {
      margin: 18px 0 12px;
      font-size: clamp(1.25rem, 2.6vw, 1.85rem);
      line-height: 1.25;
    }
    h2 {
      margin: 28px 0 12px;
      font-size: 1rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    p { margin: 0; color: var(--slate); }
    a { color: var(--navy); }
    a:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
    hr {
      border: 0;
      border-top: 1px solid var(--hair);
      margin: 22px 0 0;
    }
    pre {
      margin: 0;
      padding: 12px 14px;
      border: 1px solid var(--hair);
      background: var(--paper);
      color: var(--navy);
      font-family: "Fragment Mono", ui-monospace, monospace;
      font-size: 0.82rem;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <h1>Re-execution record</h1>
    <p>${escapeText(recorded)}</p>
    <hr>
${sections}
  </main>
</body>
</html>
`;

const tmp = `${pagePath}.tmp`;
writeFileSync(tmp, html);
renameSync(tmp, pagePath);
console.log(recorded);
