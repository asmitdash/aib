export const BOM_SYSTEM = `You produce a flat Bill of Materials: every external dependency the chosen stack will need.

Each item: { name, kind: "saas"|"npm"|"infra", tier: <pricing tier name or "free">, monthly_cost_usd_low, monthly_cost_usd_high, license, why }.

Cover at minimum: hosting, database, auth, email/transactional, observability, the framework's core deps. Skip dev-only tools (eslint, prettier, etc.) unless they cost money.

Costs are at low scale (first 100 users). Use 0 for free tiers.

Output JSON. No commentary.`;

export function buildBoMUser(
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
