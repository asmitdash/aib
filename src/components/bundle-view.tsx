"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MermaidDiagram } from "@/components/mermaid-diagram";
import { ShareButton } from "@/components/share-button";
import { ZipDownload } from "@/components/zip-download";

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

interface Blueprint {
  entities: Array<{ name: string; description: string }>;
  flows: Array<{ name: string; actor: string; trigger: string }>;
  external_services: Array<{ name: string; purpose: string }>;
  nonfunctional?: { scale?: string };
}

interface CritiqueDefect {
  quote: string;
  problem: string;
  fix: string;
}

interface Critique {
  reviews: Array<{
    artifact_id: string;
    scores: { correctness: number; specificity: number; consistency: number };
    defects: CritiqueDefect[];
  }>;
  rewrite_targets: string[];
}

interface Manifest {
  schema_version: 1;
  bundle_version: number;
  generated_at: string;
  spec_hash: string;
  model_id: string;
  pattern: { pattern: string; confidence: number; reasoning: string };
  blueprint: Blueprint;
  files: string[];
  errors: Array<{ artifact: string; code: string; message: string }>;
  critique?: Critique;
  diagram_error?: string;
  usage: {
    total_usd: number;
    total_output_tokens: number;
  };
}

interface StoredPayload {
  bundle: Bundle;
  blueprint: Blueprint;
  manifest: Manifest;
  specHash: string;
}

const BUNDLE_KEY = (id: string) => `aib:bundle:${id}`;

function formatTitle(blueprint: Blueprint): string {
  if (blueprint.entities.length === 0) return "Architecture bundle";
  const top = blueprint.entities
    .slice(0, 2)
    .map((e) => e.name.replace(/-/g, " "))
    .join(" + ");
  return `${top} system`;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return iso;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

const SECTION_IDS = [
  { id: "stack", label: "Stack" },
  { id: "bom", label: "BoM" },
  { id: "datamodel", label: "Data model" },
  { id: "failures", label: "Failures" },
  { id: "cost", label: "Cost" },
  { id: "plan", label: "Plan" },
] as const;

export function BundleView({ id }: { id: string }): React.JSX.Element {
  const router = useRouter();
  const [payload, setPayload] = React.useState<StoredPayload | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(BUNDLE_KEY(id));
      } catch {
        raw = null;
      }
      if (!raw) {
        setMissing(true);
        return;
      }
      try {
        setPayload(JSON.parse(raw) as StoredPayload);
      } catch {
        setMissing(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">
          This bundle isn&apos;t on this device.
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          In V1, bundles live in your browser&apos;s local storage. The person
          who generated it can re-share, or you can paste the spec at /
          to regenerate.
        </p>
        <div className="mt-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-24 text-center text-sm text-[var(--muted-foreground)]">
        Loading bundle…
      </div>
    );
  }

  const { bundle, blueprint, manifest } = payload;
  const title = formatTitle(blueprint);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
              Generated {formatTimeAgo(manifest.generated_at)} ·{" "}
              {manifest.model_id} · pattern: {manifest.pattern.pattern} · $
              {manifest.usage.total_usd.toFixed(3)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ZipDownload
              id={id}
              payload={{ bundle, manifest, blueprint }}
            />
            <ShareButton id={id} />
          </div>
        </div>
      </header>

      <Card>
        <CardContent className="p-6">
          {bundle.diagram_mmd ? (
            <MermaidDiagram source={bundle.diagram_mmd} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
              <Badge variant="outline">Diagram unavailable</Badge>
              <span>
                {manifest.diagram_error ??
                  "The diagram could not be generated for this bundle."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <nav className="sticky top-14 z-30 -mx-6 flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur">
        {SECTION_IDS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-[var(--border)] px-4 py-1 text-xs hover:bg-[var(--accent)]"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <Accordion
        type="multiple"
        defaultValue={["stack", "bom", "failures", "cost", "plan"]}
        className="space-y-1"
      >
        <AccordionItem value="stack" id="stack">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Stack</h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {bundle.stack.picks.map((p) => (
                <div
                  key={p.layer}
                  className="grid grid-cols-1 gap-2 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[140px_1fr]"
                >
                  <div className="text-sm font-medium capitalize text-[var(--muted-foreground)]">
                    {p.layer}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {p.why}
                    </div>
                    {p.rejected.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[var(--muted-foreground)]">
                          Rejected alternatives ({p.rejected.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {p.rejected.map((r) => (
                            <li key={r.name}>
                              <span className="font-medium">{r.name}</span> —{" "}
                              <span className="text-[var(--muted-foreground)]">
                                {r.reason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bom" id="bom">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Bill of Materials</h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Kind</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2 text-right">Cost (low)</th>
                    <th className="px-2 py-2 text-right">Cost (high)</th>
                    <th className="px-2 py-2">License</th>
                    <th className="px-2 py-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.bom.items.map((item, i) => (
                    <tr
                      key={`${item.name}-${i}`}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="px-2 py-2 font-medium">{item.name}</td>
                      <td className="px-2 py-2 text-[var(--muted-foreground)]">
                        {item.kind}
                      </td>
                      <td className="px-2 py-2 text-[var(--muted-foreground)]">
                        {item.tier}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        ${item.monthly_cost_usd_low}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        ${item.monthly_cost_usd_high}
                      </td>
                      <td className="px-2 py-2 text-[var(--muted-foreground)]">
                        {item.license}
                      </td>
                      <td className="px-2 py-2 text-[var(--muted-foreground)]">
                        {item.why}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="datamodel" id="datamodel">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Data model</h2>
          </AccordionTrigger>
          <AccordionContent>
            <Tabs defaultValue="tables">
              <TabsList>
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="ddl">DDL</TabsTrigger>
              </TabsList>
              <TabsContent value="tables" className="space-y-4">
                {bundle.datamodel.tables.map((t) => (
                  <div key={t.name}>
                    <h3 className="font-mono text-sm font-semibold">
                      {t.name}
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      {t.columns.map((c) => (
                        <li key={c.name} className="font-mono">
                          {c.name}: {c.type}
                          {c.nullable ? "" : " NOT NULL"}
                          {c.default ? ` DEFAULT ${c.default}` : ""}
                          {c.comment ? `  -- ${c.comment}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="ddl">
                <ScrollArea className="h-[480px] rounded-md border border-[var(--border)] bg-[var(--muted)]">
                  <pre className="p-4 font-mono text-xs">
                    {bundle.datamodel.ddl}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="failures" id="failures">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Failure modes</h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {bundle.failures.map((c, i) => (
                <Card key={`${c.title}-${i}`}>
                  <CardHeader className="pb-2">
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div>
                      <span className="font-medium">Trigger: </span>
                      <span className="text-[var(--muted-foreground)]">
                        {c.trigger}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Blast radius: </span>
                      <span className="text-[var(--muted-foreground)]">
                        {c.blast_radius}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Detection: </span>
                      <span className="text-[var(--muted-foreground)]">
                        {c.detection}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Mitigation: </span>
                      <span className="text-[var(--muted-foreground)]">
                        {c.mitigation}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cost" id="cost">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Cost &amp; effort</h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Monthly infra
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono">
                    Low ${bundle.estimate.monthly_infra_usd.low}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    Expected ${bundle.estimate.monthly_infra_usd.expected}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    High ${bundle.estimate.monthly_infra_usd.high}
                  </Badge>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Engineer-weeks to v1
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono">
                    Low {bundle.estimate.engineer_weeks.low}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    Expected {bundle.estimate.engineer_weeks.expected}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    High {bundle.estimate.engineer_weeks.high}
                  </Badge>
                </div>
              </div>
              {bundle.estimate.assumptions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Assumptions
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted-foreground)]">
                    {bundle.estimate.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="plan" id="plan">
          <AccordionTrigger>
            <h2 className="text-lg font-semibold">Build plan</h2>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-3">
              {bundle.estimate.milestones.map((m) => (
                <li key={m.id} className="border-l-2 border-[var(--primary)] pl-4">
                  <div className="text-sm font-medium">
                    {m.id} — {m.name}{" "}
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      ({m.week})
                    </span>
                  </div>
                  {m.deliverables.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted-foreground)]">
                      {m.deliverables.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                  {m.depends_on.length > 0 && (
                    <div className="mt-1 text-xs italic text-[var(--muted-foreground)]">
                      Depends on: {m.depends_on.join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {manifest.critique && manifest.critique.rewrite_targets.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">
              What the critique pass caught
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {manifest.critique.rewrite_targets.length} artifact
              {manifest.critique.rewrite_targets.length === 1 ? "" : "s"}{" "}
              rewritten before showing you.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {manifest.critique.reviews
              .filter(
                (r) =>
                  manifest.critique?.rewrite_targets.includes(r.artifact_id) &&
                  r.defects.length > 0,
              )
              .map((r) => (
                <div key={r.artifact_id}>
                  <div className="font-medium capitalize">{r.artifact_id}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--muted-foreground)]">
                    {r.defects.map((d, i) => (
                      <li key={i}>
                        <span className="italic">{d.problem}</span> — fix:{" "}
                        {d.fix}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
