# Talk to the Machine

A chat interface wired to a real LLM through the [Groq](https://console.groq.com/) API. Built with
Next.js (App Router), React, TypeScript and Tailwind CSS for the 4Geeks Academy
"Chat Interface with a Real AI API" project.

## Features

- **Real AI replies:** uses Groq's OpenAI-compatible Chat Completions endpoint.
- **Conversation memory:** the API is stateless, so the **full message history** is sent on every turn.
- **Token tracking:** shows prompt, completion and total tokens for the last response and as running session totals, plus the total request count.
- **Extra metrics:** model name, response time, tokens/sec, Groq queue and total time, request and message counts.
- **Model selector:** choose GPT-OSS 20B (default), GPT-OSS 120B, or Qwen3.8 27B from the Groq model allow-list.
- **Readable error handling:** errors from Groq (bad key, rate limits, invalid requests, outages) and network failures show in a warning banner, together with Groq's own error message when it sends one. A **Retry** button resends the last message.
- **Persistence:** messages, token totals and the selected model are saved to `localStorage` and restored on reload.
- **Clear conversation:** resets the messages and counters and removes the saved session from `localStorage`.
- **Readable replies:** Markdown headings, lists, fenced code, links, and tables; raw HTML is disabled.
- **Mobile layout:** collapsible telemetry keeps the conversation and composer visible, with horizontally scrollable tables and code.

## Getting started

1. Create a free account at <https://console.groq.com/> and generate an API key.
2. Copy the env template and add your key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local
   NEXT_PUBLIC_GROQ_API_KEY=your_actual_groq_api_key_here
   ```

   (`GROQ_API_KEY` is also accepted as a fallback name.)

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>.

### Verify the API key (optional)

Before running the app, check that the key authenticates against Groq:

```bash
export $(grep -v '^#' .env.local | xargs)
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $NEXT_PUBLIC_GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-oss-20b","messages":[{"role":"user","content":"Hello!"}]}'
```

## How the key stays private

Next.js inlines a `NEXT_PUBLIC_*` variable into the browser JavaScript of any **client** code
that reads it, where anyone visiting the site could see it. So the browser never calls Groq
directly. It calls the app's own route `POST /api/chat`
([`app/api/chat/route.ts`](app/api/chat/route.ts)). That route runs on the server, reads
`NEXT_PUBLIC_GROQ_API_KEY`, validates the request and forwards the full history to Groq.
Because only server code reads the variable, the key never appears in the client bundle.

## Answer accuracy

Malformed Groq responses are rejected with a visible error: replies must be
non-empty, and usage must contain non-negative integer token counts with consistent
totals. Optional timing metadata must be finite and non-negative. Failed responses
do not append an assistant reply or update session counters; retry remains available.

The server prepends instructions with the current UTC date to every request.
The assistant is instructed to acknowledge uncertainty, avoid invented sources or
current-data claims, and ask for location and experience before estimating salaries.
These instructions also apply to existing conversations; they do not rewrite old replies.
When web search is off, the UI warns that answers are not live-verified. Prompt instructions reduce
overconfident answers but cannot guarantee correctness or provide verified current data.
Check important claims against reliable, current sources.

### Optional Exa web search

1. Create a key at <https://dashboard.exa.ai/api-keys>.
2. Add `EXA_API_KEY=your_key` to `.env.local` and restart the server.
3. Enable **Search the web** above the input.

The server calls Exa's search API directly using a private key, then passes up to
five source excerpts to Groq as untrusted reference data. No MCP setup is needed.
Only the first 400 characters of your latest message go to Exa; include the subject
and location in follow-up questions. Queries use Exa credits and are processed by Exa.
Search is enabled automatically when the app opens or reloads; no login is required.
You can turn it off using the checkbox. Enabled requests use Exa credits.

Replies include clickable retrieved sources and publication dates when supplied.
Sources persist with the conversation and are removed by Clear Conversation.
Retrieved sources are not proof that every generated claim is supported or current.
The model is instructed to cite relevant evidence and acknowledge uncertainty.
Search errors (missing key, network issues, quota limits, empty results) stop the
request with a visible error; no silent model-only fallback occurs. Retry or turn
off search to continue normally. Groq token totals include the added search context;
Exa credit consumption is separate and is not included in the token panel.

## State and persistence

`components/Chat.tsx` holds the core state: `messages`, `input`, `isLoading`, `error` and
`sessionStats` (`promptTokens`, `completionTokens`, `totalTokens`, `totalRequests`, plus timing
data).

- **On mount**, `useEffect` restores the messages and session stats from `localStorage`.
- **On every change**, `messages` and `sessionStats` are written back to `localStorage`.
- **Clear conversation** resets the state, sets the counters to zero and removes the session
  key from `localStorage`. The selected model is kept under its own key.

## Project structure

```
app/
  api/chat/route.ts   # server route: proxies requests to Groq
  page.tsx            # renders <Chat />
components/
  Chat.tsx            # state, fetching, persistence, reset
  MessageList.tsx     # message history + "Thinking…" indicator
  ChatInput.tsx       # input bar (Enter to send, Shift+Enter for newline)
  StatsSidebar.tsx    # model selector, token/metric stats, clear button
lib/
  groq.ts             # request validation, Groq call, error mapping
  stats.ts            # token accumulation and tokens/sec
  storage.ts          # localStorage load/save/clear with validation
  models.ts           # supported model allow-list
  types.ts            # shared types
tests/                # Vitest unit tests
```

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm start`     | Serve the production build |
| `npm run lint`  | ESLint                   |
| `npm test`      | Run the Vitest unit tests |

## Changing models

Edit the allow-list in [`lib/models.ts`](lib/models.ts). Check
<https://console.groq.com/docs/models> for the models Groq currently offers.
The current list was checked against Groq's `/openai/v1/models` endpoint. A saved
selection that is no longer in the allow-list resets to the default on reload,
without clearing conversation history or token totals.
