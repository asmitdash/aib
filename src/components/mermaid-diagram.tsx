"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";

interface Props {
  source: string;
  className?: string;
}

let _mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid(): Promise<typeof import("mermaid").default> {
  if (_mermaidPromise) return _mermaidPromise;
  _mermaidPromise = import("mermaid").then((mod) => {
    const m = mod.default;
    m.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
    });
    return m;
  });
  return _mermaidPromise;
}

type RenderState =
  | { status: "rendering" }
  | { status: "ok"; svg: string }
  | { status: "error"; error: string };

export function MermaidDiagram({
  source,
  className,
}: Props): React.JSX.Element {
  const [state, setState] = React.useState<RenderState>({
    status: "rendering",
  });
  const reactId = React.useId();
  // mermaid wants a CSS-id-friendly string; React.useId returns ":r0:" etc.
  const renderId = `aib-mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = source?.trim() ?? "";
    const work = trimmed
      ? loadMermaid().then((m) => m.render(renderId, trimmed))
      : Promise.reject(new Error("empty diagram"));
    work
      .then((res) => {
        if (cancelled) return;
        setState({ status: "ok", svg: res.svg });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source, renderId]);

  const error = state.status === "error" ? state.error : null;
  const svg = state.status === "ok" ? state.svg : null;

  if (error) {
    return (
      <div className={className}>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="destructive">Diagram failed to render</Badge>
          <span className="text-xs text-[var(--muted-foreground)]">
            Showing source
          </span>
        </div>
        <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--muted)] p-4 font-mono text-xs">
          {source}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={`${className ?? ""} flex h-64 items-center justify-center text-sm text-[var(--muted-foreground)]`}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className={className}
      // mermaid.render returns sanitized SVG; securityLevel=strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
