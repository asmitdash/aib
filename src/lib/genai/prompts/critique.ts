export const CRITIQUE_SYSTEM = `You are a senior staff engineer doing a hostile architecture review.

Score each artifact 1-10 on: correctness, specificity, internal consistency. Flag the weakest 30% (round up; with 6 artifacts, that's 2). For each flagged artifact, list 1-3 specific defects with quotes.

Be uncharitable. "Looks fine" is not a review. If you can't find a real defect, say "no defect found" — do not invent one.

Output JSON: { reviews: [{artifact_id, scores: {correctness, specificity, consistency}, defects: [{quote, problem, fix}]}], rewrite_targets: [<artifact_id>] }`;

export function buildCritiqueUser(
  blueprintJson: string,
  bundleJson: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nOutput strict JSON only.`
    : "";
  return `Blueprint IR:
${blueprintJson}

Generated bundle:
${bundleJson}${errSuffix}`;
}
