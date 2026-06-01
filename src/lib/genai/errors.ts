// Typed errors for the Gemini pipeline. Kept module-local so `server-only`
// boundary doesn't taint pure-data imports.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export class BudgetExceededError extends Error {
  readonly stage: string;
  readonly totals: { usd: number; outputTokens: number };
  readonly caps: { usd: number; outputTokens: number };
  constructor(
    stage: string,
    totals: { usd: number; outputTokens: number },
    caps: { usd: number; outputTokens: number },
  ) {
    super(
      `[aib] budget exceeded at stage ${stage}: ` +
        `usd=${totals.usd.toFixed(4)}/${caps.usd.toFixed(2)}, ` +
        `output_tokens=${totals.outputTokens}/${caps.outputTokens}`,
    );
    this.name = "BudgetExceededError";
    this.stage = stage;
    this.totals = totals;
    this.caps = caps;
  }
}

export class StageError extends Error {
  readonly code: string;
  readonly stage: string;
  readonly cause?: unknown;
  constructor(stage: string, code: string, message: string, cause?: unknown) {
    super(`[aib:${stage}] ${code}: ${message}`);
    this.name = "StageError";
    this.code = code;
    this.stage = stage;
    this.cause = cause;
  }
}
