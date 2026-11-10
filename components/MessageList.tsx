"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import MarkdownMessage from "./MarkdownMessage";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  hydrated: boolean;
}

export default function MessageList({ messages, isLoading, hydrated }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
      aria-live="polite"
    >
      {hydrated && messages.length === 0 && !isLoading && (
        <div className="flex h-full items-center justify-center text-center text-zinc-500">
          <p>
            No messages yet. Say hello to start the conversation.
          </p>
        </div>
      )}

      <ul className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((m, i) => (
          <li
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`min-w-0 max-w-[95%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[85%] ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <p className={`mb-1 text-xs font-semibold ${m.role === "user" ? "text-blue-100" : "text-zinc-500"}`}>
                {m.role === "user" ? "You" : "Assistant"}
              </p>
              {m.role === "assistant" ? (
                <MarkdownMessage content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </li>
        ))}

        {isLoading && (
          <li className="flex justify-start">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </li>
        )}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
