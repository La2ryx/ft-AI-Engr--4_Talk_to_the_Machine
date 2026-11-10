import type { GroqUsage, SessionStats, TurnMetrics } from "./types";

export function emptyStats(): SessionStats {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalRequests: 0,
    totalResponseTimeMs: 0,
    lastTurn: null,
  };
}

const toMs = (seconds: number | undefined): number | null =>
  typeof seconds === "number" && Number.isFinite(seconds)
    ? Math.round(seconds * 1000)
    : null;

/**
 * Prefers Groq's own generation time (completion_time) for throughput;
 * falls back to the client-measured round-trip time.
 */
export function tokensPerSecond(usage: GroqUsage, elapsedMs: number): number {
  const seconds =
    usage.completion_time && usage.completion_time > 0
      ? usage.completion_time
      : elapsedMs / 1000;
  if (seconds <= 0) return 0;
  return Math.round(((usage.completion_tokens ?? 0) / seconds) * 10) / 10;
}

export function buildTurnMetrics(
  usage: GroqUsage,
  elapsedMs: number,
  model: string,
): TurnMetrics {
  return {
    model,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    responseTimeMs: Math.round(elapsedMs),
    tokensPerSecond: tokensPerSecond(usage, elapsedMs),
    queueTimeMs: toMs(usage.queue_time),
    groqTotalTimeMs: toMs(usage.total_time),
  };
}

export function accumulateStats(
  stats: SessionStats,
  usage: GroqUsage,
  elapsedMs: number,
  model: string,
): SessionStats {
  const turn = buildTurnMetrics(usage, elapsedMs, model);
  return {
    promptTokens: stats.promptTokens + turn.promptTokens,
    completionTokens: stats.completionTokens + turn.completionTokens,
    totalTokens: stats.totalTokens + turn.totalTokens,
    totalRequests: stats.totalRequests + 1,
    totalResponseTimeMs: stats.totalResponseTimeMs + turn.responseTimeMs,
    lastTurn: turn,
  };
}
