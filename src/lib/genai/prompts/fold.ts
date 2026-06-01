export const FOLD_SYSTEM = `You revise a Blueprint IR given user answers to clarifying questions.

Rules:
- Output the FULL revised IR, not a diff. Same schema as input.
- If an answer contradicts the existing IR, the answer wins. Update the IR.
- If an answer is "skip" or empty, leave that part of the IR unchanged.
- Do not invent fields that weren't asked about.

Output JSON only.`;

export function buildFoldUser(
  blueprintJson: string,
  qaPairsJson: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed with: ${lastError}\nOutput strict JSON only.`
    : "";
  return `Original Blueprint IR:
${blueprintJson}

Q&A pairs:
${qaPairsJson}${errSuffix}`;
}
