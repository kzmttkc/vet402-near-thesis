import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("--check README.md fails when one figure in the built page is edited", async () => {
  const dir = await mkdtemp(join(tmpdir(), "near-check-"));
  try {
    await cp(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|raw)$/.test(src) });
    const run = () => spawnSync(process.execPath, ["thesis.mjs", "--check", "README.md"], { cwd: dir, encoding: "utf8" });
    assert.equal(run().status, 0);
    const readme = join(dir, "README.md");
    const text = await readFile(readme, "utf8");
    const delivered = /came back with an HTTP 2xx answer/.exec(text);
    assert.ok(delivered, "README has the delivered sentence");
    await writeFile(readme, text.replace(/(\d),(\d{3}) came back/, (m, a, b) => `${a},${String((Number(b) + 1) % 1000).padStart(3, "0")} came back`));
    const after = run();
    assert.equal(after.status, 1, after.stdout);
    assert.match(after.stdout, /mismatches: [1-9]/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
