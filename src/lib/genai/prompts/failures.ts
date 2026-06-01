export const FAILURES_SYSTEM = `You produce 5 to 10 failure mode cards for the chosen architecture.

Each card, fixed shape:
- title: <short, specific. NOT "database goes down". YES "Neon primary failover stalls writes for 30-90s">
- trigger: <what causes it>
- blast_radius: <who/what is affected>
- detection: <specific signal: a metric, an alert, a user report>
- mitigation: <what to do. Concrete. NOT "monitor everything">

Bias toward failure modes specific to this architecture, not generic "the server could crash". Start from the reference pattern's failure_modes_seed and add up to 5 more that are specific to the spec's entities and external services. Cap total at 10.

Output JSON.`;

export function buildFailuresUser(
  blueprintJson: string,
  patternId: string,
  patternDoc: string,
  stackJson: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nOutput strict JSON only.`
    : "";
  return `Blueprint IR:
${blueprintJson}

Chosen reference pattern: ${patternId}
Reference architecture notes:
${patternDoc}

Recommended stack:
${stackJson}${errSuffix}`;
}
