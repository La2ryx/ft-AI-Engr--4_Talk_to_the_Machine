"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL, type ModelId } from "@/lib/models";
import { accumulateStats, emptyStats } from "@/lib/stats";
import {
  clearSession,
  loadModel,
  loadSession,
  saveModel,
  saveSession,
} from "@/lib/storage";
import type {
  ChatApiError,
  ChatApiSuccess,
  ChatMessage,
  SessionStats,
} from "@/lib/types";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import StatsSidebar from "./StatsSidebar";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>(emptyStats);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [hydrated, setHydrated] = useState(false);

  // localStorage is only available in the browser, so restore after mount.
  useEffect(() => {
    const saved = loadSession();
    /* eslint-disable react-hooks/set-state-in-effect */
    setMessages(saved.messages);
    setSessionStats(saved.stats);
    setModel(loadModel());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Skip until hydrated so the initial empty state never overwrites saved data.
  useEffect(() => {
    if (!hydrated) return;
    saveSession({ messages, stats: sessionStats });
  }, [hydrated, messages, sessionStats]);

  useEffect(() => {
    if (hydrated) saveModel(model);
  }, [hydrated, model]);

  const requestReply = useCallback(
    async (history: ChatMessage[]) => {
      setIsLoading(true);
      setError(null);
      const started = performance.now();
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, model }),
        });
        const data = (await res.json().catch(() => null)) as
          | ChatApiSuccess
          | ChatApiError
          | null;

        if (!res.ok || !data || "error" in data) {
          throw new Error(
            data && "error" in data
              ? data.error
              : `Request failed with status ${res.status}.`,
          );
        }

        const elapsed = performance.now() - started;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
        setSessionStats((prev) =>
          accumulateStats(prev, data.usage, elapsed, data.model),
        );
      } catch (err) {
        setError(
          err instanceof TypeError
            ? "Network error: could not reach the server."
            : err instanceof Error
              ? err.message
              : "Something went wrong.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [model],
  );

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isLoading || !hydrated) return;
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(updatedMessages);
    setInput("");
    void requestReply(updatedMessages);
  };

  const handleRetry = () => {
    if (!isLoading) void requestReply(messages);
  };

  const handleClear = () => {
    if (
      messages.length > 0 &&
      !window.confirm("Clear the conversation and reset token counters?")
    ) {
      return;
    }
    setMessages([]);
    setSessionStats(emptyStats());
    setError(null);
    setInput("");
    clearSession();
  };

  const canRetry =
    !isLoading && messages.length > 0 && messages.at(-1)?.role === "user";

  return (
    <div className="flex h-dvh w-full flex-col bg-zinc-50 text-zinc-900 md:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">Talk to the Machine</h1>
          <p className="text-sm text-zinc-500">
            Chat powered by Groq &middot; full history sent every turn
          </p>
          <p className="text-xs text-zinc-500">
            No live web access. Answers may be inaccurate or outdated; verify important facts.
          </p>
        </header>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          hydrated={hydrated}
        />

        {error && (
          <div
            role="alert"
            className="mx-6 mb-2 flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 font-medium hover:underline"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {canRetry && (
          <div className="mx-6 mb-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ↻ Retry last message
            </button>
          </div>
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading || !hydrated}
        />
      </main>

      <StatsSidebar
        stats={sessionStats}
        messageCount={messages.length}
        model={model}
        onModelChange={setModel}
        onClear={handleClear}
        busy={isLoading || !hydrated}
      />
    </div>
  );
}
