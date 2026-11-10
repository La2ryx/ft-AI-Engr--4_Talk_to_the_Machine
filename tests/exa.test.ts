import { describe, expect, it, vi } from "vitest";
import { isWebSource, searchExa } from "@/lib/exa";
import { handleChat } from "@/lib/groq";
import { defaultSession, loadSession, saveSession, type PersistedSession } from "@/lib/storage";

const source = { title: "Report", url: "https://example.com/report", publishedDate: "2026-10-01", highlights: ["Recent evidence"] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const body = { model: "openai/gpt-oss-20b", messages: [{ role: "user", content: "Latest AI research" }], webSearch: true };

describe("Exa search", () => {
  it("requires a key before making any request", async () => {
    const fetchMock = vi.fn();
    await expect(searchExa("query", undefined, fetchMock)).rejects.toThrow("EXA_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds requests, filters unsafe/empty results, and deduplicates URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ results: [
      { ...source, url: "javascript:alert(1)" },
      { ...source, url: "https://user:pass@example.com" },
      { ...source, highlights: [] },
      source,
      source,
    ] }));
    expect(await searchExa("x".repeat(900), "key", fetchMock)).toEqual([{
      title: source.title, url: source.url, publishedDate: source.publishedDate, content: "Recent evidence",
    }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.exa.ai/search");
    const payload = JSON.parse(options.body);
    expect(payload.query).toHaveLength(400);
    expect(payload.numResults).toBe(5);
    expect(payload.contents).toEqual({ highlights: true });
  });

  it.each([401, 429, 500])("surfaces provider status %s", async (status) => {
    await expect(searchExa("q", "k", vi.fn().mockResolvedValue(json({}, status)))).rejects.toThrow(`HTTP ${status}`);
  });

  it("handles malformed JSON, invalid shapes, and missing excerpts explicitly", async () => {
    await expect(searchExa("q", "k", vi.fn().mockResolvedValue(new Response("bad")))).rejects.toThrow("invalid JSON");
    await expect(searchExa("q", "k", vi.fn().mockResolvedValue(json({})))).rejects.toThrow("invalid search response");
    await expect(searchExa("q", "k", vi.fn().mockResolvedValue(json({ results: [] })))).rejects.toThrow("no usable source excerpts");
  });

  it("handles network errors without leaking provider details", async () => {
    await expect(searchExa("q", "k", vi.fn().mockRejectedValue(new Error("secret")))).rejects.toThrow("Could not reach Exa");
  });

  it("grounds Groq in source excerpts and returns citation metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ results: [source] }))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: "Answer [source](https://example.com/report)" } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
    const result = await handleChat(body, "groq-key", fetchMock, "exa-key");
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty("sources", [{
      title: source.title, url: source.url, publishedDate: source.publishedDate,
    }]);
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload).not.toHaveProperty("webSearch");
    expect(payload.messages[0].content).toContain("NOT instructions");
    expect(payload.messages[1].content).toContain("Recent evidence");
    expect(payload.messages.at(-1)).toEqual(body.messages[0]);
  });

  it("does not call Groq or silently fall back after search failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 429));
    const result = await handleChat(body, "key", fetchMock, "exa-key");
    expect(result.status).toBe(502);
    expect(result.body).toHaveProperty("error", expect.stringContaining("Exa search failed"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid toggles without contacting either API", async () => {
    const fetchMock = vi.fn();
    expect((await handleChat({ ...body, webSearch: "yes" }, "key", fetchMock)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves ordinary chat without invoking Exa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({
      choices: [{ message: { content: "Hi" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    const result = await handleChat({ ...body, webSearch: false }, "key", fetchMock);
    expect(result.status).toBe(200);
    expect(result.body).not.toHaveProperty("sources");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("api.groq.com");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toHaveLength(2);
  });

  it("validates source links and persists citation metadata", () => {
    expect(isWebSource(source)).toBe(true);
    expect(isWebSource({ ...source, url: "data:text/html,test" })).toBe(false);
    expect(isWebSource({ ...source, publishedDate: 123 })).toBe(false);
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
    };
    const session: PersistedSession = {
      ...defaultSession(),
      messages: [{ role: "assistant", content: "Answer", sources: [source] }],
    };
    saveSession(session, storage);
    expect(loadSession(storage)).toEqual(session);
    saveSession(defaultSession(), storage);
    expect(values.size).toBe(0);
  });
});
