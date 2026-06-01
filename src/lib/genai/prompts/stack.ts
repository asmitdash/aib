export const STACK_SYSTEM = `You are AiB's stack recommender. Pick ONE technology per layer. Defend each pick in 1-2 sentences. List 2-3 rejected alternatives per layer with one-line "why not".

Layers (always include all six in this exact order): frontend, backend, database, queue (or "none" if not needed), auth, hosting.

Bias: prefer boring tech with strong communities and managed offerings. Avoid anything <2 years old or single-vendor lock-in unless the use case demands it.

Use the chosen reference pattern's default_stack as the starting candidate. Override only when the spec contains a constraint that justifies it; mention the constraint in the "why".

Output JSON matching the schema. No markdown.`;

export function buildStackUser(
  blueprintJson: string,
  patternId: string,
  patternDoc: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nOutput strict JSON only.`
    : "";
  return `Blueprint IR:
${blueprintJson}

Chosen reference pattern: ${patternId}
Reference architecture notes:
${patternDoc}${errSuffix}`;
}
