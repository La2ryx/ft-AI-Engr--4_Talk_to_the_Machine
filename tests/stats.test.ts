import { describe, expect, it } from "vitest";
import { accumulateStats, emptyStats, tokensPerSecond } from "@/lib/stats";
import type { GroqUsage } from "@/lib/types";

const usage: GroqUsage = {
  prompt_tokens: 100,
  completion_tokens: 50,
  total_tokens: 150,
  queue_time: 0.012,
  completion_time: 0.25,
  total_time: 0.3,
};

describe("tokensPerSecond", () => {
  it("uses Groq completion_time when available", () => {
    expect(tokensPerSecond(usage, 2000)).toBe(200);
  });

  it("falls back to client elapsed time", () => {
    expect(tokensPerSecond({ ...usage, completion_time: undefined }, 500)).toBe(100);
  });

  it("returns 0 when no time is measurable", () => {
    expect(tokensPerSecond({ ...usage, completion_time: 0 }, 0)).toBe(0);
  });
});

describe("accumulateStats", () => {
  it("adds each turn to running totals and records the last turn", () => {
    const first = accumulateStats(emptyStats(), usage, 400, "m1");
    const second = accumulateStats(
      first,
      { prompt_tokens: 200, completion_tokens: 10, total_tokens: 210 },
      600,
      "m2",
    );

    expect(second).toMatchObject({
      promptTokens: 300,
      completionTokens: 60,
      totalTokens: 360,
      totalRequests: 2,
      totalResponseTimeMs: 1000,
    });
    expect(first.lastTurn).toMatchObject({
      model: "m1",
      queueTimeMs: 12,
      groqTotalTimeMs: 300,
      tokensPerSecond: 200,
    });
    expect(second.lastTurn).toMatchObject({
      model: "m2",
      queueTimeMs: null,
      groqTotalTimeMs: null,
    });
  });

  it("does not mutate the previous stats", () => {
    const base = emptyStats();
    accumulateStats(base, usage, 100, "m");
    expect(base).toEqual(emptyStats());
  });
});
