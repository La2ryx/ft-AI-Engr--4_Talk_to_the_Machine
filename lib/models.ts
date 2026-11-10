export const MODELS = [
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "qwen/qwen3.8-27b", label: "Qwen3.8 27B" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "openai/gpt-oss-20b";

export function isSupportedModel(id: unknown): id is ModelId {
  return typeof id === "string" && MODELS.some((m) => m.id === id);
}
