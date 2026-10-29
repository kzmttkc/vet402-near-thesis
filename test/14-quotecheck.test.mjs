import assert from "node:assert/strict";
import { test } from "node:test";
import { checkQuotes, htmlToText, judgeQuote, normalize, sourceUrl } from "../lib/quotecheck.mjs";

test("quote check folds page noise but not changed words", () => {
  assert.equal(normalize("NEAR Intents , private  and x402&#39;s ’pay’"), "NEAR Intents, private and x402's 'pay'");
  assert.equal(judgeQuote("NEAR is building infrastructure.", htmlToText("<p>NEAR is <a>building</a> infrastructure .</p>")), "ok");
  assert.equal(judgeQuote("Today, NEAR offers infrastructure.", "NEAR is building infrastructure."), "missing");
  assert.equal(sourceUrl("https://x.com/a/status/1").fetchUrl, "https://api.fxtwitter.com/a/status/1");
  assert.equal(sourceUrl("https://example.com/r.pdf").kind, "pdf");
});

test("posts are read from the tweet text and the article", async () => {
  const body = JSON.stringify({ tweet: { text: "Agents don't need crypto.", article: { blocks: [{ text: "Q3 was big." }] } } });
  const fetchImpl = async () => ({ ok: true, text: async () => body });
  const out = await checkQuotes(
    [
      { id: "a", url: "https://x.com/u/status/1", full_sentence: "Agents don't need crypto." },
      { id: "b", url: "https://x.com/u/status/1", full_sentence: "Q3 was big." },
      { id: "c", url: "https://x.com/u/status/1", full_sentence: "Q3 was small." },
    ],
    { fetchImpl },
  );
  assert.deepEqual(out.map((r) => r.result), ["ok", "ok", "missing"]);
});
