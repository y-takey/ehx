export async function fetchHtml(url: string, timeout: number = 30): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(timeout * 1000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  return await res.text();
}
