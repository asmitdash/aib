import "server-only";

import type { ZodTypeAny } from "zod";

/**
 * Provider-agnostic options for a single LLM call.
 *
 * Some fields are provider-specific and ignored by providers that don't
 * support them — documented inline. Stages.ts builds these once per call;
 * each provider translates as needed.
 */
export interface LLMCallOpts<T> {
  /** stage tag for budget tracking + error messages */
  stage: string;
  /** model id; chosen by stages.ts from getModelIds() */
  model: string;
  /** system prompt. Gemini may ignore this if `cachedContent` is set */
  systemPrompt: string;
  /** user prompt */
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  /**
   * Zod schema for structured output. When present, providers return parsed
   * JSON conforming to this schema in `output`. When absent, providers return
   * a plain string in `output`.
   */
  responseSchema?: ZodTypeAny;
  /**
   * Gemini-only: pre-built Gemini Schema object. When present and the
   * provider is Gemini, this is used directly instead of deriving from Zod.
   * Other providers ignore this and derive JSON Schema from `responseSchema`.
   */
  geminiSchema?: unknown;
  /** Gemini-only: name of an explicit cache (e.g. "cachedContents/abc") */
  cachedContent?: string | null;
  /** Gemini-only: thinking budget in tokens */
  thinkingBudget?: number;
  signal?: AbortSignal;
}

export interface LLMUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface LLMCallResult<T> {
  output: T;
  usage: LLMUsage;
}

export type ProviderName = "anthropic" | "openai" | "gemini";

export interface LLMProvider {
  name: ProviderName;
  callJSON<T>(opts: LLMCallOpts<T>): Promise<LLMCallResult<T>>;
  callText(opts: LLMCallOpts<string>): Promise<LLMCallResult<string>>;
}
