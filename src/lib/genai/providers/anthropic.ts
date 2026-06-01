import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";

import { StageError } from "../errors";
import type {
  LLMCallOpts,
  LLMCallResult,
  LLMProvider,
  LLMUsage,
  ProviderName,
} from "./types";

const RESPOND_TOOL_NAME = "respond";

export class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async callJSON<T>(opts: LLMCallOpts<T>): Promise<LLMCallResult<T>> {
    if (!opts.responseSchema) {
      throw new StageError(
        opts.stage,
        "missing_schema",
        "Anthropic callJSON requires responseSchema",
      );
    }
    // zod-to-json-schema's published types still narrow to Zod v3 schemas, but
    // it accepts Zod v4 schemas at runtime (see its peerDependencies). The
    // cast is the boundary fix.
    const inputSchema = zodToJsonSchema(
      opts.responseSchema as never,
      {
        target: "openApi3",
        $refStrategy: "none",
      },
    ) as Record<string, unknown>;

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create(
        {
          model: opts.model,
          max_tokens: opts.maxOutputTokens,
          temperature: opts.temperature,
          system: opts.systemPrompt,
          tools: [
            {
              name: RESPOND_TOOL_NAME,
              description:
                "Return the structured response. Always call this tool exactly once.",
              input_schema: inputSchema as Anthropic.Messages.Tool["input_schema"],
            },
          ],
          tool_choice: { type: "tool", name: RESPOND_TOOL_NAME },
          messages: [{ role: "user", content: opts.userPrompt }],
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

    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === RESPOND_TOOL_NAME,
    );
    if (!toolBlock) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "Anthropic did not return a tool_use block",
      );
    }
    return {
      output: toolBlock.input as T,
      usage: extractUsage(response.usage),
    };
  }

  async callText(opts: LLMCallOpts<string>): Promise<LLMCallResult<string>> {
    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create(
        {
          model: opts.model,
          max_tokens: opts.maxOutputTokens,
          temperature: opts.temperature,
          system: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
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

    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text",
    );
    const text = textBlock?.text ?? "";
    if (!text || !text.trim()) {
      throw new StageError(
        opts.stage,
        "empty_response",
        "Anthropic returned empty text",
      );
    }
    return {
      output: text,
      usage: extractUsage(response.usage),
    };
  }
}

function extractUsage(usage: Anthropic.Messages.Usage | undefined): LLMUsage {
  const cached =
    (usage?.cache_read_input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0);
  return {
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: cached,
    outputTokens: usage?.output_tokens ?? 0,
  };
}
