import { USER_AGENT } from "./http.mjs";

// Fold the differences a web page adds on its own: entities, curly quotes, runs of spaces.
export function normalize(text) {
  return String(text ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    // Inline links leave a space before the comma ("NEAR Intents , private").
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}

export function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function collectText(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectText(n, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "text" && typeof value === "string") out.push(value);
      else collectText(value, out);
    }
  }
  return out;
}

// x.com pages need a login to read, so posts are read through the public fxtwitter API.
export function sourceUrl(url) {
  const m = /^https:\/\/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/i.exec(url);
  if (m) return { kind: "x", fetchUrl: `https://api.fxtwitter.com/${m[1]}/status/${m[2]}` };
  if (/\.pdf($|\?)/i.test(url)) return { kind: "pdf", fetchUrl: null };
  return { kind: "html", fetchUrl: url };
}

export function textFromResponse(kind, body) {
  if (kind === "x") {
    const tweet = JSON.parse(body)?.tweet ?? {};
    return [tweet.text ?? "", ...collectText(tweet.article ?? {}, [])].join(" ");
  }
  return htmlToText(body);
}

export function judgeQuote(sentence, sourceText) {
  return normalize(sourceText).includes(normalize(sentence)) ? "ok" : "missing";
}

export async function checkQuotes(quotes, { fetchImpl = fetch } = {}) {
  const cache = new Map();
  const results = [];
  for (const q of quotes) {
    const { kind, fetchUrl } = sourceUrl(q.url);
    if (!fetchUrl) {
      results.push({ id: q.id, result: "not machine-checked (PDF)" });
      continue;
    }
    try {
      if (!cache.has(fetchUrl)) {
        const res = await fetchImpl(fetchUrl, { headers: { "user-agent": USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cache.set(fetchUrl, textFromResponse(kind, await res.text()));
      }
      results.push({ id: q.id, result: judgeQuote(q.full_sentence, cache.get(fetchUrl)) });
    } catch (err) {
      results.push({ id: q.id, result: `not checked (${err.message})` });
    }
  }
  return results;
}
