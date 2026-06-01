// Rewrite stage reuses the original Stage-4 system prompt for the artifact,
// with a defects appendix. The stages.ts module wires this together — this
// file just owns the appendix template.

export function buildRewriteAppendix(defectsJson: string): string {
  return `\n\nA senior reviewer flagged the following defects in your previous output:
${defectsJson}

Produce a corrected version. Address every defect. Same output schema as before.`;
}
