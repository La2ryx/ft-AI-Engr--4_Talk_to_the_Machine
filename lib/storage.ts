import { DEFAULT_MODEL, isSupportedModel, type ModelId } from "./models";
import { emptyStats } from "./stats";
import type { ChatMessage, SessionStats } from "./types";

/** Conversation history + cumulative token stats (removed on "Clear conversation"). */
export const STORAGE_KEY = "talk-to-the-machine:session:v2";
/** Selected model is a preference, so it survives clearing the conversation. */
export const MODEL_STORAGE_KEY = "talk-to-the-machine:model";

export interface PersistedSession {
  messages: ChatMessage[];
  stats: SessionStats;
}

export function defaultSession(): PersistedSession {
  return { messages: [], stats: emptyStats() };
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function isStats(value: unknown): value is SessionStats {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    isNum(s.promptTokens) &&
    isNum(s.completionTokens) &&
    isNum(s.totalTokens) &&
    isNum(s.totalRequests) &&
    isNum(s.totalResponseTimeMs) &&
    (s.lastTurn === null || typeof s.lastTurn === "object")
  );
}

export function isEmptySession(session: PersistedSession): boolean {
  return session.messages.length === 0 && session.stats.totalRequests === 0;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Returns the saved session, or defaults if nothing valid is stored. */
export function loadSession(storage = getStorage()): PersistedSession {
  const fallback = defaultSession();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const p = parsed as Record<string, unknown>;
    return {
      messages:
        Array.isArray(p.messages) && p.messages.every(isChatMessage)
          ? p.messages
          : fallback.messages,
      stats: isStats(p.stats) ? p.stats : fallback.stats,
    };
  } catch {
    return fallback;
  }
}

/** Persists the session; an empty session removes the key instead. */
export function saveSession(
  session: PersistedSession,
  storage = getStorage(),
): void {
  if (isEmptySession(session)) {
    clearSession(storage);
    return;
  }
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or storage disabled — persistence is best-effort.
  }
}

export function clearSession(storage = getStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadModel(storage = getStorage()): ModelId {
  try {
    const saved = storage?.getItem(MODEL_STORAGE_KEY);
    return isSupportedModel(saved) ? saved : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(model: ModelId, storage = getStorage()): void {
  try {
    storage?.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // ignore
  }
}
