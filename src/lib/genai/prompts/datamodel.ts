export const DATAMODEL_SYSTEM = `You produce the relational data model for the chosen architecture.

Output JSON:
{
  tables: [{ name, columns: [{name, type, nullable, default?, comment?}], primary_key: [...], indexes: [{name, columns, unique}], foreign_keys: [{column, references: "table.col", on_delete}] }],
  ddl: "<full Postgres CREATE TABLE statements as a single string, in dependency order>"
}

Postgres dialect even if the recommended DB is not Postgres (per AiB convention; the user can translate).

snake_case names. Every table has id (uuid PK default gen_random_uuid()) and created_at/updated_at unless there's a reason not to.

Use the canonical_entities from the reference pattern as the spine. Rename them to match the spec's domain language; preserve the relationships.`;

export function buildDataModelUser(
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
