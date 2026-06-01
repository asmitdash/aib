export const ESTIMATE_SYSTEM = `You produce a cost+effort estimate AND a milestone build plan for the chosen architecture.

Estimate fields:
- monthly_infra_usd: { low, expected, high }   # at low scale (first 100 users)
- engineer_weeks: { low, expected, high }       # solo senior eng to MVP
- assumptions: [<= 5 short bullets]

Use the reference pattern's cost_anchor as a sanity floor; adjust by spec specifics (heavy media -> push storage; heavy AI usage -> push API spend).

Build plan: ordered milestones M0..Mn. Each: { id, name, week, deliverables[], depends_on[] }.
- M0 = "stand up the skeleton" (one week max).
- Last milestone = "ship to first user".
- 4 to 8 milestones total.

Output JSON.`;

export function buildEstimateUser(
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
