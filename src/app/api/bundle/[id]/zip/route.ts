import { NextResponse } from "next/server";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StackPick {
  layer: string;
  name: string;
  why: string;
  rejected: Array<{ name: string; reason: string }>;
}

interface BoMItem {
  name: string;
  kind: string;
  tier: string;
  monthly_cost_usd_low: number;
  monthly_cost_usd_high: number;
  license: string;
  why: string;
}

interface DataModelTable {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    comment?: string;
  }>;
  primary_key: string[];
  indexes: Array<{ name: string; columns: string[]; unique: boolean }>;
  foreign_keys: Array<{
    column: string;
    references: string;
    on_delete: string;
  }>;
}

interface FailureCard {
  title: string;
  trigger: string;
  blast_radius: string;
  detection: string;
  mitigation: string;
}

interface Milestone {
  id: string;
  name: string;
  week: string;
  deliverables: string[];
  depends_on: string[];
}

interface Bundle {
  stack: { picks: StackPick[] };
  bom: { items: BoMItem[] };
  diagram_mmd: string | null;
  datamodel: { tables: DataModelTable[]; ddl: string };
  failures: FailureCard[];
  estimate: {
    monthly_infra_usd: { low: number; expected: number; high: number };
    engineer_weeks: { low: number; expected: number; high: number };
    assumptions: string[];
    milestones: Milestone[];
  };
}

function stackToMd(stack: Bundle["stack"]): string {
  const lines = ["# Stack", ""];
  for (const pick of stack.picks) {
    lines.push(`## ${pick.layer}: ${pick.name}`, "", pick.why, "");
    if (pick.rejected.length > 0) {
      lines.push("### Rejected alternatives", "");
      for (const r of pick.rejected) {
        lines.push(`- **${r.name}** — ${r.reason}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function bomToMd(bom: Bundle["bom"]): string {
  const lines = [
    "# Bill of Materials",
    "",
    "| Name | Kind | Tier | Cost (low) | Cost (high) | License | Why |",
    "|---|---|---|---:|---:|---|---|",
  ];
  for (const item of bom.items) {
    lines.push(
      `| ${item.name} | ${item.kind} | ${item.tier} | $${item.monthly_cost_usd_low} | $${item.monthly_cost_usd_high} | ${item.license} | ${item.why} |`,
    );
  }
  return lines.join("\n");
}

function datamodelToMd(dm: Bundle["datamodel"]): string {
  const lines = ["# Data Model", ""];
  for (const t of dm.tables) {
    lines.push(`## ${t.name}`, "");
    lines.push("| Column | Type | Nullable | Default | Comment |");
    lines.push("|---|---|---|---|---|");
    for (const c of t.columns) {
      lines.push(
        `| ${c.name} | ${c.type} | ${c.nullable ? "yes" : "no"} | ${c.default ?? "—"} | ${c.comment ?? ""} |`,
      );
    }
    lines.push("");
    if (t.primary_key.length > 0) {
      lines.push(`**Primary key:** ${t.primary_key.join(", ")}`, "");
    }
    if (t.indexes.length > 0) {
      lines.push("**Indexes:**");
      for (const i of t.indexes) {
        lines.push(
          `- ${i.name} (${i.columns.join(", ")})${i.unique ? " UNIQUE" : ""}`,
        );
      }
      lines.push("");
    }
    if (t.foreign_keys.length > 0) {
      lines.push("**Foreign keys:**");
      for (const fk of t.foreign_keys) {
        lines.push(
          `- ${fk.column} → ${fk.references} (on delete: ${fk.on_delete})`,
        );
      }
      lines.push("");
    }
  }
  lines.push("## DDL", "", "```sql", dm.ddl, "```");
  return lines.join("\n");
}

function failuresToMd(cards: Bundle["failures"]): string {
  const lines = ["# Failure Modes", ""];
  for (const c of cards) {
    lines.push(
      `## ${c.title}`,
      "",
      `- **Trigger:** ${c.trigger}`,
      `- **Blast radius:** ${c.blast_radius}`,
      `- **Detection:** ${c.detection}`,
      `- **Mitigation:** ${c.mitigation}`,
      "",
    );
  }
  return lines.join("\n");
}

function estimateToMd(est: Bundle["estimate"]): string {
  const lines = [
    "# Cost & Effort",
    "",
    "## Monthly infra (USD)",
    `- Low: $${est.monthly_infra_usd.low}`,
    `- Expected: $${est.monthly_infra_usd.expected}`,
    `- High: $${est.monthly_infra_usd.high}`,
    "",
    "## Engineer-weeks to v1",
    `- Low: ${est.engineer_weeks.low}`,
    `- Expected: ${est.engineer_weeks.expected}`,
    `- High: ${est.engineer_weeks.high}`,
    "",
    "## Assumptions",
  ];
  for (const a of est.assumptions) lines.push(`- ${a}`);
  lines.push("", "## Milestones");
  for (const m of est.milestones) {
    lines.push(`### ${m.id} — ${m.name} (${m.week})`);
    if (m.deliverables.length > 0) {
      lines.push("");
      for (const d of m.deliverables) lines.push(`- ${d}`);
    }
    if (m.depends_on.length > 0) {
      lines.push("", `*Depends on:* ${m.depends_on.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const payload = body as {
    bundle?: Bundle;
    manifest?: unknown;
    blueprint?: unknown;
  };
  if (!payload || !payload.bundle || !payload.manifest) {
    return NextResponse.json(
      {
        error: "missing_fields",
        details: "bundle and manifest are required",
      },
      { status: 400 },
    );
  }

  const bundle = payload.bundle;

  const zip = new JSZip();
  if (bundle.diagram_mmd) {
    zip.file("diagram.mmd", bundle.diagram_mmd);
  }
  zip.file("stack.md", stackToMd(bundle.stack));
  zip.file("bom.md", bomToMd(bundle.bom));
  zip.file("datamodel.md", datamodelToMd(bundle.datamodel));
  zip.file("failures.md", failuresToMd(bundle.failures));
  zip.file("estimate.md", estimateToMd(bundle.estimate));
  zip.file("manifest.json", JSON.stringify(payload.manifest, null, 2));

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="aib-bundle-${id}.zip"`,
      "Content-Length": String(buf.length),
    },
  });
}
