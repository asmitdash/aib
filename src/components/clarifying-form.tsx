"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Question = {
  id: string;
  kind: string;
  text: string;
  why_it_matters: string;
  choices?: string[];
};

type RunPayload = {
  runId: string;
  blueprint: unknown;
  questions: { questions: Question[] };
  specHash: string;
};

const RUN_KEY = (runId: string) => `aib:run:${runId}`;
const BUNDLE_KEY = (specHash: string) => `aib:bundle:${specHash}`;

const PROGRESS_PHRASES = [
  "Folding answers back into the IR…",
  "Picking the architecture pattern…",
  "Drafting the stack…",
  "Building the bill of materials…",
  "Synthesizing the data model…",
  "Writing failure modes…",
  "Estimating cost & effort…",
  "Rendering the diagram…",
  "Running the critique pass…",
];

type Phase = "loading" | "questions" | "generating" | "error";

interface Props {
  runId: string;
}

export function ClarifyingForm({ runId }: Props): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [run, setRun] = React.useState<RunPayload | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [progressIdx, setProgressIdx] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    // Defer reads to a microtask so the effect body itself is side-effect-free
    // synchronously (satisfies react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (cancelled) return;
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(RUN_KEY(runId));
      } catch {
        raw = null;
      }
      if (!raw) {
        setErrorMsg(
          "Run state isn't on this device. Restart from the home page.",
        );
        setPhase("error");
        return;
      }
      try {
        const parsed = JSON.parse(raw) as RunPayload;
        setRun(parsed);
        timeoutId = window.setTimeout(() => {
          if (!cancelled) setPhase("questions");
        }, 600);
      } catch {
        setErrorMsg("Stored run state is corrupted. Restart from /.");
        setPhase("error");
      }
    });
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [runId]);

  // Rotate progress phrases while submitting.
  React.useEffect(() => {
    if (phase !== "generating") return;
    const t = window.setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_PHRASES.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [phase]);

  const onSubmit = async (): Promise<void> => {
    if (!run) return;
    setPhase("generating");
    setProgressIdx(0);
    try {
      const payload = run.questions.questions
        .map((q) => ({ id: q.id, answer: (answers[q.id] ?? "").trim() }))
        .filter((p) => p.answer.length > 0);

      const res = await fetch(`/api/generate/${runId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const json = (await res.json()) as
        | {
            bundle: unknown;
            blueprint: unknown;
            manifest: unknown;
            specHash: string;
          }
        | { error: string; details?: string };
      if (!res.ok || "error" in json) {
        const msg =
          "error" in json
            ? `${json.error}${json.details ? `: ${json.details}` : ""}`
            : "generation failed";
        toast.error("Generation failed", { description: msg });
        setErrorMsg(msg);
        setPhase("error");
        return;
      }
      try {
        localStorage.setItem(BUNDLE_KEY(json.specHash), JSON.stringify(json));
        sessionStorage.removeItem(RUN_KEY(runId));
      } catch {
        // localStorage can throw quota errors; surface but still navigate.
      }
      router.push(`/b/${json.specHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Network error", { description: msg });
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  if (phase === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <Card className="border-[var(--destructive)]/50">
        <CardHeader>
          <h2 className="text-lg font-semibold">We couldn&apos;t continue</h2>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[var(--muted-foreground)]">
          <p>{errorMsg || "Unknown error"}</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "generating") {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <h2 className="text-2xl font-semibold">Building your architecture</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {PROGRESS_PHRASES[progressIdx]}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          This usually takes 30–50 seconds. You can leave this tab.
        </p>
      </div>
    );
  }

  // questions phase
  if (!run) return <></>;
  const qs = run.questions.questions;
  const touched = Object.values(answers).some((v) => v.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          A few quick questions
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          These most change the architecture. About 60 seconds.
        </p>
      </div>

      <div className="space-y-4">
        {qs.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                {idx + 1} of {qs.length} · {q.kind.replace("_", " ")}
              </div>
              <div className="text-base font-medium">{q.text}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.choices && q.choices.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.choices.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--accent)]"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={c}
                        checked={answers[q.id] === c}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <Textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                  placeholder="Your answer…"
                  className="min-h-[64px]"
                />
              )}
            </CardContent>
            <CardFooter className="text-xs italic text-[var(--muted-foreground)]">
              Why we ask: {q.why_it_matters}
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onSubmit} disabled={!run}>
          Skip and generate
        </Button>
        <Button onClick={onSubmit} disabled={!touched}>
          Continue
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
