// Per-million-token prices in USD as of 2026-06-01 (per Luke's pipeline doc §6).
// Cached input is 10% of fresh input on both Pro and Flash.

export interface ModelPricing {
  inputPerMtok: number;
  cachedInputPerMtok: number;
  outputPerMtok: number;
  // Storage cost for explicit caching (USD per 1M token-hours).
  cacheStoragePerMtokHr: number;
}

// Keyed by the model id PREFIX (we match the env value against these prefixes
// so that future point releases like `gemini-2.5-pro-001` resolve correctly).
const PRICING_BY_PREFIX: Array<[string, ModelPricing]> = [
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
];

export function getPricing(modelId: string): ModelPricing {
  for (const [prefix, p] of PRICING_BY_PREFIX) {
    if (modelId.startsWith(prefix)) return p;
  }
  // Conservative fallback: treat unknown models like Pro (over-estimates cost,
  // so the budget cap fires earlier rather than later — fail-closed).
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
