import { createHash } from "node:crypto";

import { BudgetError, ValidationError } from "./errors";

const MAX_SPEC_CHARS = 20_000;
const MIN_SPEC_CHARS = 40;

// Strip control chars except \n, \t. Preserves printable ASCII + unicode.
const CONTROL_CHARS_RE =
  // eslint-disable-next-line no-control-regex
  /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g;

const USER_SPEC_TAG_RE = /<\/?user_spec>/g;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Stage 0 — pure TS, no LLM. Wraps a raw user spec for safe interpolation
 * into an LLM prompt. Strips control chars, removes any `<user_spec>` tags
 * the user pasted (prompt-injection guard), wraps the cleaned text in our
 * delimiter, and emits the bundle id (first 12 hex of sha256(spec)).
 */
export function wrapSpec(rawSpec: string): {
  wrapped: string;
  cleaned: string;
  specHash: string;
} {
  if (typeof rawSpec !== "string") {
    throw new ValidationError("spec must be a string");
  }
  if (rawSpec.length > MAX_SPEC_CHARS) {
    throw new BudgetError(
      `spec exceeds ${MAX_SPEC_CHARS} chars (got ${rawSpec.length})`,
    );
  }
  const trimmed = rawSpec.trim();
  if (trimmed.length < MIN_SPEC_CHARS) {
    throw new ValidationError(
      `spec too short (need >= ${MIN_SPEC_CHARS} chars, got ${trimmed.length})`,
    );
  }
  const cleaned = rawSpec.replace(CONTROL_CHARS_RE, "");
  const safe = cleaned.replace(USER_SPEC_TAG_RE, "");
  const wrapped = `<user_spec>\n${safe}\n</user_spec>`;
  const specHash = sha256Hex(cleaned).slice(0, 12);
  return { wrapped, cleaned: safe, specHash };
}

export function specExcerpt(cleanedSpec: string, maxChars = 500): string {
  if (cleanedSpec.length <= maxChars) return cleanedSpec;
  return cleanedSpec.slice(0, maxChars);
}
