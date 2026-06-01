// Per-million-token prices in USD as of 2026-06.
//
// Models are matched by id PREFIX so that future point releases like
// `gemini-2.5-pro-001` or `claude-sonnet-4-6-20260601` resolve correctly.
//
// Provider is identified implicitly by the model prefix (`gemini-*`,
// `claude-*`, `gpt-*`). The budget tracker keys entries by model id, which
// includes the provider's distinct namespace.

export interface ModelPricing {
  inputPerMtok: number;
  cachedInputPerMtok: number;
  outputPerMtok: number;
  // Storage cost for explicit caching (USD per 1M token-hours). Gemini-only;
  // Anthropic and OpenAI prompt caching is automatic — no separate storage fee.
  cacheStoragePerMtokHr: number;
}

const PRICING_BY_PREFIX: Array<[string, ModelPricing]> = [
  // ---- Google ----
  [
    "gemini-2.5-pro",
    {
      inputPerMtok: 1.25,
      cachedInputPerMtok: 0.125,
      outputPerMtok: 10.0,
      cacheStoragePerMtokHr: 4.5,
    },
  ],
  [
    "gemini-2.5-flash",
    {
      inputPerMtok: 0.3,
      cachedInputPerMtok: 0.03,
      outputPerMtok: 2.5,
      cacheStoragePerMtokHr: 1.0,
    },
  ],
  // ---- Anthropic ----
  [
    "claude-sonnet-4-6",
    {
      inputPerMtok: 3.0,
      cachedInputPerMtok: 0.3,
      outputPerMtok: 15.0,
      cacheStoragePerMtokHr: 0,
    },
  ],
  [
    "claude-haiku-4-5",
    {
      inputPerMtok: 1.0,
      cachedInputPerMtok: 0.1,
      outputPerMtok: 5.0,
      cacheStoragePerMtokHr: 0,
    },
  ],
  // ---- OpenAI ----
  [
    "gpt-4.1-mini",
    {
      inputPerMtok: 0.4,
      cachedInputPerMtok: 0.1,
      outputPerMtok: 1.6,
      cacheStoragePerMtokHr: 0,
    },
  ],
  [
    "gpt-4.1",
    {
      inputPerMtok: 2.0,
      cachedInputPerMtok: 0.5,
      outputPerMtok: 8.0,
      cacheStoragePerMtokHr: 0,
    },
  ],
];

export function getPricing(modelId: string): ModelPricing {
  for (const [prefix, p] of PRICING_BY_PREFIX) {
    if (modelId.startsWith(prefix)) return p;
  }
  // Conservative fallback: treat unknown models like the most expensive entry
  // so the budget cap fires earlier rather than later (fail-closed).
  return PRICING_BY_PREFIX[0][1];
}

export function priceCall(
  modelId: string,
  tokens: { freshIn: number; cachedIn: number; out: number },
): number {
  const p = getPricing(modelId);
  return (
    (tokens.freshIn / 1_000_000) * p.inputPerMtok +
    (tokens.cachedIn / 1_000_000) * p.cachedInputPerMtok +
    (tokens.out / 1_000_000) * p.outputPerMtok
  );
}
