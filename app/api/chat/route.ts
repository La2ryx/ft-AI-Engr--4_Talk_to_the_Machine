import { handleChat } from "@/lib/groq";

// Read only in this server route, so the key never ships to the browser.
// Indexed access stops Next.js from inlining the NEXT_PUBLIC_ value at build
// time, so the key is read from the environment at request time instead.
// GROQ_API_KEY is accepted as a fallback name.
const KEY_NAMES = ["NEXT_PUBLIC_GROQ_API_KEY", "GROQ_API_KEY"] as const;

function getApiKey(): string | undefined {
  for (const name of KEY_NAMES) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { status, body: payload } = await handleChat(body, getApiKey());
  return Response.json(payload, { status });
}
