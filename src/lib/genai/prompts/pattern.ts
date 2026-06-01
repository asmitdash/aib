import { listPatternSummaries } from "../reference-library";

function summariesBlock(): string {
  return listPatternSummaries()
    .map(
      (p) =>
        `- ${p.id}: ${p.description}\n  When to use: ${p.when_to_use.join("; ")}\n  When not: ${p.when_not_to_use.join("; ")}`,
    )
    .join("\n\n");
}

export const PATTERN_SYSTEM_BASE = `You classify a Blueprint IR into ONE of AiB's reference architecture patterns. Pick the single best fit. If two are close, pick the simpler one.

Patterns:
{{patterns}}

Output JSON: { pattern: <id>, confidence: 0..1, runner_up: <id|""> if relevant else "", reasoning: <<=200 chars> }.`;

export function getPatternSystem(): string {
  return PATTERN_SYSTEM_BASE.replace("{{patterns}}", summariesBlock());
}

export function buildPatternUser(
  blueprintJson: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nReturn one of the listed pattern ids exactly.`
    : "";
  return `Blueprint IR:\n${blueprintJson}${errSuffix}`;
}
