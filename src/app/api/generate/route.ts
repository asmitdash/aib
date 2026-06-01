import "server-only";

import { NextResponse } from "next/server";

import { buildBundle } from "@/lib/genai/pipeline";
import { putRun } from "@/lib/genai/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", details: "request body must be JSON" },
      { status: 400 },
    );
  }

  const spec = (body as { spec?: unknown })?.spec;
  if (typeof spec !== "string") {
    return NextResponse.json(
      { error: "missing_field", details: "spec (string) is required" },
      { status: 400 },
    );
  }

  const result = await buildBundle({ rawSpec: spec });
  if (result.status === "error") {
    const status =
      result.code === "validation_failed" || result.code === "spec_too_large"
        ? 422
        : 500;
    return NextResponse.json(
      { error: result.code, details: result.details },
      { status },
    );
  }
  if (result.status !== "needs_answers") {
    // First call without answers always returns questions; "ok" here is
    // unexpected.
    return NextResponse.json(
      { error: "unexpected_status", details: result.status },
      { status: 500 },
    );
  }

  const runId = crypto.randomUUID();
  putRun(runId, {
    spec,
    blueprint: result.blueprint,
    questions: result.questions,
    specHash: result.specHash,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    runId,
    blueprint: result.blueprint,
    questions: result.questions,
    specHash: result.specHash,
  });
}
