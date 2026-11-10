"use client";

import type { FormEvent, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSubmit, disabled }: Props) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-200 px-3 py-3 sm:px-6 sm:py-4 dark:border-zinc-800"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={32000}
          placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
          className="min-h-[3rem] min-w-0 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
