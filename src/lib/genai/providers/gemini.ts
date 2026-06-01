import "server-only";

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Schema,
} from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";

import { StageError } from "../errors";
import type {
  LLMCallOpts,
  LLMCallResult,
  LLMProvider,
  ProviderName,
} from "./types";

const SAFETY_OFF: GenerateContentConfig["safetySettings"] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
}));

export class GeminiProvider implements LLMProvider {
  readonly name: ProviderName = "gemini";
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** Expose the underlying client so cache.ts can call ai.caches.create. */
  get client(): GoogleGenAI {
    return this.ai;
  }

  async callJSON<T>(opts: LLMCallOpts<T>): Promise<LLMCallResult<T>> {
    const schema = (opts.geminiSchema ??
      (opts.responseSchema
        ? (zodToJsonSchema(opts.responseSchema as never, {
            target: "openApi3",
          }) as Schema)
        : undefined)) as Schema | undefined;

    const config: GenerateContentConfig = {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      responseMimeType: "application/json",
      safetySettings: SAFETY_OFF,
      abortSignal: opts.signal,
    };
    if (schema) config.responseSchema = schema;
    if (typeof opts.thinkingBudget === "number") {
      config.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    }
    if (opts.cachedContent) {
      config.cachedContent = opts.cachedContent;
    } else {
      config.systemInstruction = opts.systemPrompt;
    }

    const response = await this.generate(opts, config);
    const text = response.text ?? "";
    if (!text || !text.trim()) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "model returned empty text",
      );
    }
    const parsed = parseJsonLoose(text);
    return {
      output: parsed as T,
      usage: extractUsage(response),
    };
  }

  async callText(opts: LLMCallOpts<string>): Promise<LLMCallResult<string>> {
    const config: GenerateContentConfig = {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      responseMimeType: "text/plain",
      safetySettings: SAFETY_OFF,
      abortSignal: opts.signal,
    };
    if (typeof opts.thinkingBudget === "number") {
      config.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    }
    if (opts.cachedContent) {
      config.cachedContent = opts.cachedContent;
    } else {
      config.systemInstruction = opts.systemPrompt;
    }

    const response = await this.generate(opts, config);
    const text = response.text ?? "";
    if (!text || !text.trim()) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "model returned empty text",
      );
    }
    return {
      output: text,
      usage: extractUsage(response),
    };
  }

  private async generate(
    opts: LLMCallOpts<unknown>,
    config: GenerateContentConfig,
  ): Promise<GenerateContentResponse> {
    try {
      return await this.ai.models.generateContent({
        model: opts.model,
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        config,
      });
    } catch (err) {
      throw new StageError(
        opts.stage,
        "api_error",
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
  }
}

function extractUsage(response: GenerateContentResponse): {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
} {
  const usage = response.usageMetadata;
  const cachedIn = usage?.cachedContentTokenCount ?? 0;
  const promptIn = usage?.promptTokenCount ?? 0;
  const freshIn = Math.max(0, promptIn - cachedIn);
  const out =
    (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  return {
    inputTokens: freshIn,
    cachedInputTokens: cachedIn,
    outputTokens: out,
  };
}

function parseJsonLoose(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*|```$/g, "")
    .trim();
  return JSON.parse(stripped);
}
