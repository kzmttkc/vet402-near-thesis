export const USER_AGENT = "vet402-near-thesis/0.1 (+https://vet402.com)";

export async function getText(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`${url} HTTP ${res.status}`);
  }
  return res.text();
}
