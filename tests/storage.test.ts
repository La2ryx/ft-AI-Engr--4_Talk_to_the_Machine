import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL } from "@/lib/models";
import { accumulateStats, emptyStats } from "@/lib/stats";
import {
  MODEL_STORAGE_KEY,
  STORAGE_KEY,
  clearSession,
  defaultSession,
  loadModel,
  loadSession,
  saveModel,
  saveSession,
  type PersistedSession,
} from "@/lib/storage";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const session: PersistedSession = {
  messages: [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ],
  stats: accumulateStats(
    emptyStats(),
    { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    120,
    DEFAULT_MODEL,
  ),
};

describe("session storage", () => {
  it("round-trips a session", () => {
    const storage = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage)).toEqual(session);
  });

  it("returns defaults when nothing is stored or storage is unavailable", () => {
    expect(loadSession(memoryStorage())).toEqual(defaultSession());
    expect(loadSession(null)).toEqual(defaultSession());
  });

  it("returns defaults for corrupt JSON", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{not json" });
    expect(loadSession(storage)).toEqual(defaultSession());
  });

  it("drops invalid fields individually", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        messages: [{ role: "system", content: "x" }],
        stats: { promptTokens: "lots" },
      }),
    });
    expect(loadSession(storage)).toEqual(defaultSession());
  });

  it("clearSession removes the key", () => {
    const storage = memoryStorage();
    saveSession(session, storage);
    clearSession(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("saving an empty session removes the key instead of storing it", () => {
    const storage = memoryStorage();
    saveSession(session, storage);
    saveSession(defaultSession(), storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("swallows storage write errors", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveSession(session, storage)).not.toThrow();
  });
});

describe("model preference", () => {
  it("round-trips a supported model and survives clearSession", () => {
    const storage = memoryStorage();
    saveModel("openai/gpt-oss-120b", storage);
    clearSession(storage);
    expect(loadModel(storage)).toBe("openai/gpt-oss-120b");
  });

  it.each(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"])(
    "replaces retired model %s without losing the conversation",
    (model) => {
      const storage = memoryStorage({ [MODEL_STORAGE_KEY]: model });
      saveSession(session, storage);
      expect(loadModel(storage)).toBe(DEFAULT_MODEL);
      expect(loadSession(storage)).toEqual(session);
    },
  );

  it("falls back to the default for unknown or missing models", () => {
    expect(loadModel(memoryStorage({ [MODEL_STORAGE_KEY]: "gpt-4" }))).toBe(DEFAULT_MODEL);
    expect(loadModel(memoryStorage())).toBe(DEFAULT_MODEL);
    expect(loadModel(null)).toBe(DEFAULT_MODEL);
  });
});
