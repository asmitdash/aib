import { SpecInput } from "@/components/spec-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TILES = [
  {
    title: "System diagram",
    body: "Mermaid, with hover rationale on every node and edge.",
  },
  {
    title: "Stack pick",
    body: "One per layer, defended; rejected alternatives surfaced.",
  },
  {
    title: "Data model",
    body: "Postgres DDL plus an entity-relationship view.",
  },
  {
    title: "Failure modes",
    body: "5–10 cards with trigger, blast radius, detection, mitigation.",
  },
  {
    title: "Cost & effort",
    body: "Monthly infra band plus engineer-week estimate to v1.",
  },
  {
    title: "Build plan",
    body: "M0..Mn weekly milestones so you know where to start Monday.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col px-6 py-16">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Paste a spec. Get an architecture.
        </h1>
        <p className="text-lg text-[var(--muted-foreground)]">
          Diagram, stack, data model, failure modes, estimate. 60 seconds. No
          login.
        </p>
      </section>

      <section className="mt-10">
        <SpecInput />
      </section>

      <hr className="my-12 border-[var(--border)]" />

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          What you&apos;ll get
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <Card key={t.title}>
              <CardHeader>
                <CardTitle className="text-base">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted-foreground)]">
                {t.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
