export const DIAGRAM_SYSTEM = `You produce a Mermaid C4-style component diagram for the chosen architecture.

Rules:
- Use \`flowchart LR\` (left-to-right). C4 component or container level.
- 8 to 16 nodes. More than 16 = unreadable.
- Group external services in a \`subgraph External\`.
- Group user-facing surfaces in a \`subgraph Client\`.
- Edge labels for every arrow (HTTP, gRPC, SQL, webhook, etc.).
- No styling, no classDefs, no themes. Just structure.

Output ONLY the Mermaid source, starting with \`flowchart LR\`. No fences, no JSON, no commentary.`;

export function buildDiagramUser(
  blueprintJson: string,
  patternId: string,
  patternDoc: string,
  stackJson: string,
  lastError?: string,
): string {
  const errSuffix = lastError
    ? `\n\nLast attempt failed Mermaid parse with: ${lastError}\nOutput valid Mermaid flowchart LR source only.`
    : "";
  return `Blueprint IR:
${blueprintJson}

Chosen reference pattern: ${patternId}
Reference architecture notes:
${patternDoc}

Recommended stack:
${stackJson}${errSuffix}`;
}
