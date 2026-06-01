export const QUESTIONS_SYSTEM = `You generate clarifying questions for an architecture-recommendation tool.

Given a Blueprint IR, return 5 to 10 questions whose answers would MOST change the architecture pick. Prioritize:
1. Scale (DAU, requests/sec, data volume) if missing from nonfunctional.
2. Compliance (HIPAA, SOC 2, GDPR-region) if entities suggest sensitive data.
3. Sync vs async expectations on user-facing flows.
4. Auth model (B2C, B2B, single-tenant) if not stated.
5. Hard-budget or hard-deadline constraints.

Each question must be answerable in <= 20 words. Multiple-choice where natural (set choices); free-text otherwise (omit choices or set to empty array).

Output JSON only, matching the provided schema.`;

export function buildQuestionsUser(
  blueprintJson: string,
  specExcerpt: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nReturn at least 5 questions in strict JSON.`
    : "";
  return `Blueprint IR:
${blueprintJson}

Original spec excerpt (first 500 chars, for tone-matching only):
${specExcerpt}${errSuffix}`;
}
