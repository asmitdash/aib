import "server-only";

import type { LLMProvider, ProviderName } from "./types";

let _provider: LLMProvider | null = null;

/**
 * Reads AIB_LLM_PROVIDER and returns a singleton provider. Provider-specific
 * SDKs are loaded lazily so that an environment that only sets, say, an
 * Anthropic key never has to instantiate (or fail-import) the OpenAI SDK.
 */
export function getProvider(): LLMProvider {
  if (_provider) return _provider;
  const raw = process.env.AIB_LLM_PROVIDER?.toLowerCase().trim();
  const name: ProviderName = !raw || raw === "gemini"
    ? "gemini"
    : raw === "anthropic"
      ? "anthropic"
      : raw === "openai"
        ? "openai"
        : (() => {
            throw new Error(
              `[aib] AIB_LLM_PROVIDER must be 'anthropic', 'openai', or 'gemini'. Got: ${raw}`,
            );
          })();

  if (name === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "[aib] AIB_LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset",
      );
    }
    // require() keeps OpenAI/Gemini SDK off the import graph for this branch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AnthropicProvider } = require("./anthropic") as typeof import("./anthropic");
    _provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  } else if (name === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "[aib] AIB_LLM_PROVIDER=openai but OPENAI_API_KEY is unset",
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIProvider } = require("./openai") as typeof import("./openai");
    _provider = new OpenAIProvider(process.env.OPENAI_API_KEY);
  } else {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "[aib] AIB_LLM_PROVIDER=gemini but GOOGLE_API_KEY is unset",
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiProvider } = require("./gemini") as typeof import("./gemini");
    _provider = new GeminiProvider(process.env.GOOGLE_API_KEY);
  }
  return _provider;
}

/** Test/dev helper — clears the singleton so env-var changes are picked up. */
export function _resetProviderForTesting(): void {
  _provider = null;
}
