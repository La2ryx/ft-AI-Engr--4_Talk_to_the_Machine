import { describe, expect, it, vi } from "vitest";
import { GROQ_URL, handleChat, validateRequest } from "@/lib/groq";

const body = {
  model: "openai/gpt-oss-20b",
  messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "What's 2+2?" },
  ],
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("validateRequest", () => {
  it("accepts a valid payload and strips extra fields", () => {
    const result = validateRequest({
      ...body,
      messages: [{ role: "user", content: "x", extra: 1 }],
    });
    expect(result).toEqual({
      model: body.model,
      messages: [{ role: "user", content: "x" }],
    });
  });

  it.each([
    [null, /JSON object/],
    [{ ...body, model: "gpt-4" }, /Unsupported model/],
    [{ ...body, model: "llama-3.3-70b-versatile" }, /Unsupported model/],
    [{ ...body, messages: [] }, /non-empty/],
    [{ ...body, messages: [{ role: "system", content: "x" }] }, /role/],
    [{ ...body, messages: [{ role: "assistant", content: "x" }] }, /last message/],
  ])("rejects invalid payload %#", (input, pattern) => {
    expect(validateRequest(input)).toMatch(pattern);
  });
});

describe("handleChat", () => {
  it("errors clearly when the API key is missing", async () => {
    const fetchMock = vi.fn();
    const result = await handleChat(body, undefined, fetchMock);
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: expect.stringMatching(/NEXT_PUBLIC_GROQ_API_KEY/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the full history and returns reply + usage", async () => {
    const usage = { prompt_tokens: 20, completion_tokens: 2, total_tokens: 22 };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        model: "openai/gpt-oss-20b",
        choices: [{ message: { role: "assistant", content: "4" } }],
        usage,
      }),
    );

    const result = await handleChat(body, "secret", fetchMock);

    expect(result).toEqual({
      status: 200,
      body: { reply: "4", model: "openai/gpt-oss-20b", usage },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GROQ_URL);
    expect(init.headers.Authorization).toBe("Bearer secret");
    const payload = JSON.parse(init.body);
    expect(payload.model).toBe(body.model);
    expect(payload.messages.slice(1)).toEqual(body.messages);
    expect(payload.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining(
        `Today's date is ${new Date().toISOString().slice(0, 10)} (UTC).`,
      ),
    });
    expect(payload.messages[0].content).toContain("no web browsing");
    expect(payload.messages[0].content).toContain("first ask for the country/city");
    expect(payload.messages[0].content).toContain("Do not claim to have checked current sources");
  });

  it("maps a 401 to a helpful key message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: "Invalid API Key" } }, 401));
    const result = await handleChat(body, "bad", fetchMock);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: expect.stringMatching(/API key.*Groq says: "Invalid API Key"/),
    });
  });

  it("maps a 429 to a rate-limit message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    const result = await handleChat(body, "k", fetchMock);
    expect(result.status).toBe(429);
    expect(result.body).toEqual({ error: expect.stringMatching(/Rate limit/) });
  });

  it("surfaces Groq's error message for other 4xx responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: "messages: content too long" } }, 400),
      );
    const result = await handleChat(body, "k", fetchMock);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: 'Groq request failed with status 400. Groq says: "messages: content too long"',
    });
  });

  it("maps upstream 5xx to 502", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("oops", { status: 503 }));
    const result = await handleChat(body, "k", fetchMock);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: expect.stringMatching(/trouble/) });
  });

  it("handles network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await handleChat(body, "k", fetchMock);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: expect.stringMatching(/reach Groq/) });
  });

  it("handles unexpected response shapes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [] }));
    const result = await handleChat(body, "k", fetchMock);
    expect(result.status).toBe(502);
  });
});
