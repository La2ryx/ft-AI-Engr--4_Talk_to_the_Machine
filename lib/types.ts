export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** Raw `usage` object returned by Groq (OpenAI-compatible). Times are in seconds. */
export interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  queue_time?: number;
  prompt_time?: number;
  completion_time?: number;
  total_time?: number;
}

export interface TurnMetrics {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  tokensPerSecond: number;
  queueTimeMs: number | null;
  groqTotalTimeMs: number | null;
}

export interface SessionStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalRequests: number;
  totalResponseTimeMs: number;
  lastTurn: TurnMetrics | null;
}

export interface ChatApiRequest {
  messages: ChatMessage[];
  model: string;
}

export interface ChatApiSuccess {
  reply: string;
  model: string;
  usage: GroqUsage;
}

export interface ChatApiError {
  error: string;
}
