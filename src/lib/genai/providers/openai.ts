import "server-only";

import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";

import { StageError } from "../errors";
import type {
  LLMCallOpts,
  LLMCallResult,
  LLMProvider,
  LLMUsage,
  ProviderName,
} from "./types";

export class OpenAIProvider implements LLMProvider {
  readonly name: ProviderName = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async callJSON<T>(opts: LLMCallOpts<T>): Promise<LLMCallResult<T>> {
    if (!opts.responseSchema) {
      throw new StageError(
        opts.stage,
        "missing_schema",
        "OpenAI callJSON requires responseSchema",
      );
    }
    const jsonSchema = zodToJsonSchema(opts.responseSchema as never, {
      target: "openApi3",
      $refStrategy: "none",
    }) as Record<string, unknown>;

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.client.chat.completions.create(
        {
          model: opts.model,
          temperature: opts.temperature,
          max_tokens: opts.maxOutputTokens,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: opts.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response",
              schema: jsonSchema,
              strict: false,
            },
          },
        },
        opts.signal ? { signal: opts.signal } : undefined,
      );
    } catch (err) {
      throw new StageError(
        opts.stage,
        "api_error",
        err instanceof Error ? err.message : String(err),
        err,
      );
    }

    const text = response.choices[0]?.message?.content ?? "";
    if (!text || !text.trim()) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "OpenAI returned empty content",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new StageError(
        opts.stage,
        "json_parse_error",
        err instanceof Error ? err.message : String(err),
      );
    }
    return {
      output: parsed as T,
      usage: extractUsage(response.usage),
    };
  }

  async callText(opts: LLMCallOpts<string>): Promise<LLMCallResult<string>> {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.client.chat.completions.create(
        {
          model: opts.model,
          temperature: opts.temperature,
          max_tokens: opts.maxOutputTokens,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: opts.userPrompt },
          ],
        },
        opts.signal ? { signal: opts.signal } : undefined,
      );
    } catch (err) {
      throw new StageError(
        opts.stage,
        "api_error",
        err instanceof Error ? err.message : String(err),
        err,
      );
    }

    const text = response.choices[0]?.message?.content ?? "";
    if (!text || !text.trim()) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "OpenAI returned empty content",
      );
    }
    return {
      output: text,
      usage: extractUsage(response.usage),
    };
  }
}

function extractUsage(
  usage: OpenAI.Completions.CompletionUsage | undefined,
): LLMUsage {
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const promptTotal = usage?.prompt_tokens ?? 0;
  return {
    inputTokens: Math.max(0, promptTotal - cached),
    cachedInputTokens: cached,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}
