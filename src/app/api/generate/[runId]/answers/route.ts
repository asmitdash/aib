import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBundle } from "@/lib/genai/pipeline";
import { QAPairZ } from "@/lib/genai/schemas/questions";
import { deleteRun, getRun } from "@/lib/genai/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodyZ = z.object({
  answers: z.array(QAPairZ),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", details: "request body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = BodyZ.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        details: parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }

  const run = getRun(runId);
  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found",
        details: "run state expired or never existed; restart from /",
      },
      { status: 404 },
    );
  }

  const result = await buildBundle({
    rawSpec: run.spec,
    answers: parsed.data.answers,
  });

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
  if (result.status !== "ok") {
    return NextResponse.json(
      { error: "unexpected_status", details: result.status },
      { status: 500 },
    );
  }

  // Run state served its purpose; free it.
  deleteRun(runId);

  return NextResponse.json({
    bundle: result.bundle,
    blueprint: result.blueprint,
    manifest: result.manifest,
    specHash: result.specHash,
  });
}
