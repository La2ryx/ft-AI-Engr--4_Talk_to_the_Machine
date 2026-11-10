"use client";

import type { ReactNode } from "react";
import { MODELS, type ModelId } from "@/lib/models";
import type { SessionStats } from "@/lib/types";

interface Props {
  stats: SessionStats;
  messageCount: number;
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  onClear: () => void;
  busy: boolean;
}

const fmt = (n: number) => n.toLocaleString();
const fmtMs = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${fmt(n)} ms`;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <dl>{children}</dl>
    </section>
  );
}

export default function StatsSidebar({
  stats,
  messageCount,
  model,
  onModelChange,
  onClear,
  busy,
}: Props) {
  const last = stats.lastTurn;
  const avgMs =
    stats.totalRequests > 0
      ? Math.round(stats.totalResponseTimeMs / stats.totalRequests)
      : null;

  return (
    <aside aria-label="Session telemetry" className="max-h-[45dvh] w-full shrink-0 overflow-y-auto border-t border-zinc-200 bg-zinc-100 p-4 md:max-h-none md:w-80 md:border-l md:border-t-0 dark:border-zinc-800 dark:bg-zinc-950">
      <details className="md:hidden">
        <summary className="flex items-center justify-between text-sm font-medium">
          <span>Session telemetry</span>
          <span className="text-xs text-zinc-500">{fmt(stats.totalTokens)} tokens / {fmt(stats.totalRequests)} requests</span>
        </summary>
      </details>
      <div className="mobile-telemetry mt-4 hidden flex-col gap-4 md:mt-0 md:flex">
      <div>
        <label
          htmlFor="model-select"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
        >
          Model
        </label>
        <select
          id="model-select"
          value={model}
          disabled={busy}
          onChange={(e) => onModelChange(e.target.value as ModelId)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <Section title="Session totals">
        <Row label="Active model" value={model} />
        <Row label="Prompt tokens" value={fmt(stats.promptTokens)} />
        <Row label="Completion tokens" value={fmt(stats.completionTokens)} />
        <Row label="Total tokens" value={fmt(stats.totalTokens)} />
        <Row label="Total requests" value={fmt(stats.totalRequests)} />
        <Row label="Messages" value={fmt(messageCount)} />
        <Row label="Avg response time" value={fmtMs(avgMs)} />
      </Section>

      <Section title="Last response">
        <Row label="Model" value={last?.model ?? "—"} />
        <Row label="Prompt tokens" value={last ? fmt(last.promptTokens) : "—"} />
        <Row
          label="Completion tokens"
          value={last ? fmt(last.completionTokens) : "—"}
        />
        <Row label="Total tokens" value={last ? fmt(last.totalTokens) : "—"} />
        <Row label="Response time" value={fmtMs(last?.responseTimeMs)} />
        <Row
          label="Tokens / sec"
          value={last ? fmt(last.tokensPerSecond) : "—"}
        />
        <Row label="Groq queue time" value={fmtMs(last?.queueTimeMs)} />
        <Row label="Groq total time" value={fmtMs(last?.groqTotalTimeMs)} />
      </Section>

      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        className="mt-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
      >
        Clear conversation
      </button>
      </div>
    </aside>
  );
}
