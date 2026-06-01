"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE_SPEC = `A B2B invoicing tool for solo consultants and small agencies. Multi-tenant: each customer is an agency with up to ~10 internal users. Stripe Connect for client payouts. Webhooks from QuickBooks to keep ledger entries in sync. Roughly 500 paying customers in year one, 5k in year two. Solo founder, six-month runway. Need email reminders for overdue invoices and a public-facing client portal where the agency's clients can view and pay invoices without an account.`;

const TOKEN_BUDGET = 5000;
const MIN_CHARS = 40;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const RUN_KEY = (runId: string) => `aib:run:${runId}`;

export function SpecInput(): React.JSX.Element {
  const router = useRouter();
  const [spec, setSpec] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const tokens = estimateTokens(spec);
  const overBudget = tokens > TOKEN_BUDGET;
  const tooShort = spec.trim().length < MIN_CHARS;
  const disabled = submitting || tooShort || overBudget;

  let counterText = `${tokens.toLocaleString()} / ${TOKEN_BUDGET.toLocaleString()} tokens`;
  let counterClass = "text-[var(--muted-foreground)]";
  if (overBudget) {
    counterText = `${tokens.toLocaleString()} / ${TOKEN_BUDGET.toLocaleString()} — trim to continue`;
    counterClass = "text-[var(--destructive)]";
  } else if (tokens > TOKEN_BUDGET * 0.8) {
    counterText = `${tokens.toLocaleString()} / ${TOKEN_BUDGET.toLocaleString()} — getting tight`;
    counterClass = "text-amber-500";
  }

  const onSubmit = async (): Promise<void> => {
    if (disabled) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const json = (await res.json()) as
        | {
            runId: string;
            blueprint: unknown;
            questions: unknown;
            specHash: string;
          }
        | { error: string; details?: string };
      if (!res.ok || "error" in json) {
        const msg =
          "error" in json
            ? `${json.error}${json.details ? `: ${json.details}` : ""}`
            : "request failed";
        toast.error("Could not start generation", { description: msg });
        return;
      }
      try {
        sessionStorage.setItem(RUN_KEY(json.runId), JSON.stringify(json));
      } catch {
        // sessionStorage can throw in private mode; the page falls back.
      }
      router.push(`/generate/${json.runId}`);
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          aria-label="Spec input"
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder='e.g. "A B2B invoicing tool. Stripe Connect for payouts. Multi-tenant. Webhooks from QuickBooks. ~500 paying customers in year one. Solo founder, six-month runway."'
          className="min-h-[260px] resize-y font-sans text-base leading-7"
          disabled={submitting}
        />
        <div
          className={`absolute bottom-3 left-4 font-mono text-xs ${counterClass}`}
        >
          {counterText}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSpec(SAMPLE_SPEC)}
          disabled={submitting}
        >
          Try a sample spec
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          title={
            tooShort
              ? "A bit more detail — at least a paragraph"
              : overBudget
                ? "Trim the spec to continue"
                : undefined
          }
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              Generate
              <ArrowRight />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
