import type { WebSource } from "./types";

export interface SearchResult extends WebSource {
  content: string;
}

export function isWebSource(value: unknown): value is WebSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  if (
    typeof source.title !== "string" ||
    typeof source.url !== "string" ||
    (source.publishedDate !== undefined && typeof source.publishedDate !== "string")
  ) return false;
  try {
    const url = new URL(source.url);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function searchExa(
  query: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchResult[]> {
  if (!apiKey) {
    throw new Error("Web search is not configured. Add EXA_API_KEY to .env.local and restart the server, or turn off web search.");
  }
  let response: Response;
  try {
    response = await fetchImpl("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query.slice(0, 400),
        type: "auto",
        numResults: 5,
        contents: { highlights: true },
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("Could not reach Exa or the search timed out. Retry or turn off web search.");
  }
  if (!response.ok) {
    throw new Error(`Exa search failed (HTTP ${response.status}). Check your API key and credits, or turn off web search.`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Exa returned invalid JSON. Retry or turn off web search.");
  }
  if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
    throw new Error("Exa returned an invalid search response. Retry or turn off web search.");
  }
  const results: SearchResult[] = [];
  for (const item of data.results) {
    if (!isWebSource(item) || !("highlights" in item) || !Array.isArray(item.highlights)) continue;
    const content = item.highlights.filter((text: unknown): text is string => typeof text === "string").join("\n").slice(0, 2000);
    if (!content.trim() || results.some((result) => result.url === item.url)) continue;
    results.push({
      title: item.title.slice(0, 300),
      url: item.url,
      ...(item.publishedDate ? { publishedDate: item.publishedDate.slice(0, 50) } : {}),
      content,
    });
    if (results.length === 5) break;
  }
  if (!results.length) {
    throw new Error("Exa found no usable source excerpts. Try a more specific question or turn off web search.");
  }
  return results;
}
