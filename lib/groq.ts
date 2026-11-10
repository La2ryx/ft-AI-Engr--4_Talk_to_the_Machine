import { isSupportedModel } from "./models";
import { isChatMessage } from "./storage";
import type { ChatApiError, ChatApiSuccess, ChatMessage, GroqUsage } from "./types";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MESSAGES = 200;
const MAX_CONTENT_CHARS = 32_000;

export interface HandlerResult {
  status: number;
  body: ChatApiSuccess | ChatApiError;
}

const fail = (status: number, error: string): HandlerResult => ({
  status,
  body: { error },
});

/** Validates the client payload; returns an error message or the clean payload. */
export function validateRequest(
  body: unknown,
): { messages: ChatMessage[]; model: string } | string {
  if (!body || typeof body !== "object") return "Request body must be a JSON object.";
  const { messages, model } = body as Record<string, unknown>;
  if (!isSupportedModel(model)) return "Unsupported model.";
  if (!Array.isArray(messages) || messages.length === 0)
    return "`messages` must be a non-empty array.";
  if (messages.length > MAX_MESSAGES)
    return `Conversation too long (max ${MAX_MESSAGES} messages). Clear the conversation to continue.`;
  if (!messages.every(isChatMessage))
    return "Each message needs a role of 'user' or 'assistant' and string content.";
  if (messages.some((m) => m.content.length > MAX_CONTENT_CHARS))
    return `A message exceeds ${MAX_CONTENT_CHARS} characters.`;
  if (messages[messages.length - 1].role !== "user")
    return "The last message must come from the user.";
  return {
    messages: messages.map(({ role, content }) => ({ role, content })),
    model,
  };
}

/** Friendly summary per status, followed by Groq's own error message when it sent one. */
export function describeUpstreamError(status: number, detail?: string): string {
  let summary: string;
  switch (status) {
    case 401:
      summary =
        "Groq rejected the API key. Check NEXT_PUBLIC_GROQ_API_KEY in .env.local.";
      break;
    case 404:
      summary = "The selected model is not available on Groq.";
      break;
    case 413:
      summary =
        "The conversation is too large for this model. Clear the conversation and try again.";
      break;
    case 429:
      summary =
        "Rate limit reached on Groq's free tier. Wait a moment and try again.";
      break;
    default:
      summary =
        status >= 500
          ? "Groq is having trouble right now. Please try again shortly."
          : `Groq request failed with status ${status}.`;
  }
  return detail ? `${summary} Groq says: "${detail}"` : summary;
}

export async function handleChat(
  body: unknown,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<HandlerResult> {
  if (!apiKey) {
    return fail(
      500,
      "Server is missing NEXT_PUBLIC_GROQ_API_KEY. Add it to .env.local and restart the dev server.",
    );
  }

  const validated = validateRequest(body);
  if (typeof validated === "string") return fail(400, validated);

  let res: Response;
  try {
    res = await fetchImpl(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...validated,
        messages: [
          {
            role: "system",
            content: [
              `Today's date is ${new Date().toISOString().slice(0, 10)} (UTC).`,
              "Be concise, helpful, and honest about uncertainty. You have no web browsing or live research tools.",
              "Do not claim to have checked current sources or invent citations, links, statistics, or salary ranges.",
              "For time-sensitive facts, explain that you cannot verify current information. Clearly label any historical figures or rough estimates with their timeframe and limitations.",
              "For salary questions, first ask for the country/city and experience level if missing from the conversation. Distinguish base salary from total compensation and state the currency explicitly.",
              "Do not treat earlier assistant claims as verified evidence. Correct unsupported or outdated claims rather than repeating them.",
            ].join("\n"),
          },
          ...validated.messages,
        ],
      }),
    });
  } catch {
    return fail(502, "Could not reach Groq. Check your network connection.");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data as { error?: { message?: unknown } } | null)?.error
      ?.message;
    const detail = typeof message === "string" ? message : undefined;
    const status = res.status === 401 || res.status === 429 ? res.status : 502;
    return fail(status, describeUpstreamError(res.status, detail));
  }

  const parsed = data as {
    model?: string;
    usage?: GroqUsage;
    choices?: { message?: { content?: string } }[];
  } | null;
  const reply = parsed?.choices?.[0]?.message?.content;
  if (typeof reply !== "string") {
    return fail(502, "Groq returned an unexpected response format.");
  }

  return {
    status: 200,
    body: {
      reply,
      model: parsed?.model ?? validated.model,
      usage: parsed?.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    },
  };
}
