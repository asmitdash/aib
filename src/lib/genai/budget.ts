import { BudgetExceededError } from "./errors";
import { priceCall } from "./pricing";

export interface BudgetCaps {
  usd: number;
  outputTokens: number;
}

export interface BudgetEntry {
  stage: string;
  model: string;
  freshInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  usd: number;
}

export function readBudgetCapsFromEnv(): BudgetCaps {
  const usd = Number.parseFloat(process.env.AIB_BUDGET_USD ?? "0.50");
  const out = Number.parseInt(
    process.env.AIB_BUDGET_OUTPUT_TOKENS ?? "50000",
    10,
  );
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error(
      `[aib] AIB_BUDGET_USD must be a positive number (got ${process.env.AIB_BUDGET_USD ?? ""})`,
    );
  }
  if (!Number.isInteger(out) || out <= 0) {
    throw new Error(
      `[aib] AIB_BUDGET_OUTPUT_TOKENS must be a positive integer (got ${process.env.AIB_BUDGET_OUTPUT_TOKENS ?? ""})`,
    );
  }
  return { usd, outputTokens: out };
}

export class BudgetTracker {
  readonly caps: BudgetCaps;
  private _entries: BudgetEntry[] = [];
  private _totalUsd = 0;
  private _totalOutputTokens = 0;

  constructor(caps: BudgetCaps) {
    this.caps = caps;
  }

  get totalUsd(): number {
    return this._totalUsd;
  }

  get totalOutputTokens(): number {
    return this._totalOutputTokens;
  }

  get entries(): readonly BudgetEntry[] {
    return this._entries;
  }

  /**
   * Record a single LLM call. Throws BudgetExceededError if either cap is
   * breached after this call. Caller decides whether to abort the bundle.
   */
  track(
    stage: string,
    model: string,
    tokens: {
      freshInputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
    },
  ): BudgetEntry {
    const usd = priceCall(model, {
      freshIn: tokens.freshInputTokens,
      cachedIn: tokens.cachedInputTokens,
      out: tokens.outputTokens,
    });
    const entry: BudgetEntry = {
      stage,
      model,
      freshInputTokens: tokens.freshInputTokens,
      cachedInputTokens: tokens.cachedInputTokens,
      outputTokens: tokens.outputTokens,
      usd,
    };
    this._entries.push(entry);
    this._totalUsd += usd;
    this._totalOutputTokens += tokens.outputTokens;

    if (
      this._totalUsd > this.caps.usd ||
      this._totalOutputTokens > this.caps.outputTokens
    ) {
      throw new BudgetExceededError(
        stage,
        { usd: this._totalUsd, outputTokens: this._totalOutputTokens },
        this.caps,
      );
    }
    return entry;
  }

  snapshot(): {
    totalUsd: number;
    totalOutputTokens: number;
    entries: BudgetEntry[];
    caps: BudgetCaps;
  } {
    return {
      totalUsd: this._totalUsd,
      totalOutputTokens: this._totalOutputTokens,
      entries: [...this._entries],
      caps: this.caps,
    };
  }
}
