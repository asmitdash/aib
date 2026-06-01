import "server-only";

import { ensureCaches } from "./cache";
import { getGenAI, getModelIds } from "./client";
import { BudgetTracker, readBudgetCapsFromEnv } from "./budget";
import {
  BudgetExceededError,
  StageError,
  ValidationError,
  BudgetError,
} from "./errors";
import { specExcerpt, wrapSpec } from "./safety";
import { patternDocFor } from "./reference-library";
import {
  critique as critiqueArtifacts,
  foldAnswers,
  generateBoM,
  generateDataModel,
  generateDiagram,
  generateEstimate,
  generateFailures,
  generateQuestions,
  generateStack,
  parseSpec,
  pickPattern,
  rewriteArtifact,
  type BundleArtifactError,
  type BundleArtifacts,
  type GenAIDeps,
  type Stage4Input,
} from "./stages";
import type { Blueprint } from "./schemas/blueprint";
import type {
  QAPair,
  QuestionSet,
} from "./schemas/questions";
import type { PatternPick } from "./schemas/pattern-pick";
import type { StackRec } from "./schemas/stack";
import type { BoM } from "./schemas/bom";
import type { DataModel } from "./schemas/datamodel";
import type { FailureCard } from "./schemas/failures";
import type { EstimatePlan } from "./schemas/estimate-plan";
import type { ArtifactId, Critique, Defect } from "./schemas/critique";

export interface BundleManifest {
  schema_version: 1;
  bundle_version: number;
  generated_at: string;
  spec_hash: string;
  model_id: string;
  pattern: PatternPick;
  blueprint: Blueprint;
  files: string[];
  errors: BundleArtifactError[];
  critique?: Critique;
  diagram_error?: string;
  usage: {
    total_usd: number;
    total_output_tokens: number;
    entries: Array<{
      stage: string;
      model: string;
      freshInputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      usd: number;
    }>;
  };
}

export interface BundleResult {
  stack: StackRec;
  bom: BoM;
  diagram_mmd: string | null;
  datamodel: DataModel;
  failures: FailureCard[];
  estimate: EstimatePlan;
}

export type BuildBundleInput = {
  rawSpec: string;
  answers?: QAPair[] | null;
  signal?: AbortSignal;
};

export type BuildBundleResult =
  | {
      status: "needs_answers";
      questions: QuestionSet;
      blueprint: Blueprint;
      specHash: string;
    }
  | {
      status: "ok";
      bundle: BundleResult;
      blueprint: Blueprint;
      manifest: BundleManifest;
      specHash: string;
    }
  | {
      status: "error";
      code: string;
      details: string;
      specHash?: string;
    };

const FILES_LIST = [
  "diagram.mmd",
  "stack.md",
  "bom.md",
  "datamodel.md",
  "failures.md",
  "estimate.md",
  "manifest.json",
];

/**
 * Top-level orchestrator. Per Luke §7 `buildBundle`.
 *
 * - First call (answers null/undefined): runs Stages 0+1+2a, returns
 *   {status: "needs_answers", questions, blueprint, specHash}.
 * - Second call (answers present): runs Stages 2b -> 5, returns the bundle.
 * - On budget breach or stage failure, returns {status: "error", ...}.
 */
export async function buildBundle(
  input: BuildBundleInput,
): Promise<BuildBundleResult> {
  let specHash: string | undefined;
  try {
    // ---- Stage 0 — wrap & hash ----
    const wrap = wrapSpec(input.rawSpec);
    specHash = wrap.specHash;
    const wrappedSpec = wrap.wrapped;
    const cleanedSpec = wrap.cleaned;

    // ---- Setup deps ----
    const ai = getGenAI();
    const models = getModelIds();
    const caps = readBudgetCapsFromEnv();
    const budget = new BudgetTracker(caps);

    // Kick off cache creation in parallel with Stage 1 (Luke §5).
    const cachesPromise = ensureCaches(ai, models, specHash);

    const baseDeps = (cacheHandles: {
      fastCache: string | null;
      genCache: string | null;
    }): GenAIDeps => ({
      ai,
      models,
      specHash: specHash ?? "",
      budget,
      caches: cacheHandles,
      signal: input.signal,
    });

    // ---- Stage 1 — parse ----
    // Stage 1 doesn't use caches, so we can start it before caches resolve.
    const noCaches = { fastCache: null, genCache: null };
    const blueprint: Blueprint = await parseSpec(
      { wrappedSpec },
      baseDeps(noCaches),
    );

    // Caches are needed from Stage 2a onward.
    const caches = await cachesPromise;
    const deps = baseDeps(caches);

    // ---- Branch: needs_answers vs full bundle ----
    if (!input.answers) {
      const questions = await generateQuestions(
        { blueprint, specExcerpt: specExcerpt(cleanedSpec) },
        deps,
      );
      return {
        status: "needs_answers",
        questions,
        blueprint,
        specHash,
      };
    }

    // ---- Stage 2b — fold ----
    const revisedBlueprint =
      input.answers.length > 0
        ? await foldAnswers({ blueprint, answers: input.answers }, deps)
        : blueprint;

    // ---- Stage 3 — pickPattern ----
    const pattern = await pickPattern({ blueprint: revisedBlueprint }, deps);
    const patternDoc = patternDocFor(pattern.pattern);

    // ---- Stage 4 — parallel artifact generation ----
    // Stack first because BoM/datamodel/failures/estimate use stackJson.
    const stage4Base: Stage4Input = {
      blueprint: revisedBlueprint,
      pattern,
      patternDoc,
    };

    const errors: BundleArtifactError[] = [];

    // Stack is the substrate the others consume — must complete first.
    let stack: StackRec | null = null;
    try {
      stack = await generateStack(stage4Base, deps);
    } catch (err) {
      errors.push({
        artifact: "stack",
        code: "stage4_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (!stack) {
      // Without a stack we can't usefully run the dependent generators.
      throw new StageError(
        "4.1.stack",
        "stack_required",
        "stack generation failed; aborting bundle",
      );
    }

    const stackJson = JSON.stringify(stack);
    const stage4: Stage4Input = { ...stage4Base, stackJson };

    const settle = <T>(
      id: ArtifactId | "diagram",
      p: Promise<T>,
    ): Promise<T | null> =>
      p.catch((err) => {
        errors.push({
          artifact: id,
          code: "stage4_failed",
          message: err instanceof Error ? err.message : String(err),
        });
        return null;
      });

    const [bom, diagramResult, datamodel, failures, estimate] =
      await Promise.all([
        settle<BoM>("bom", generateBoM(stage4, deps)),
        settle<{ mmd: string | null; error?: string }>(
          "diagram",
          generateDiagram(stage4, deps),
        ),
        settle<DataModel>("datamodel", generateDataModel(stage4, deps)),
        settle<FailureCard[]>("failures", generateFailures(stage4, deps)),
        settle<EstimatePlan>("estimate", generateEstimate(stage4, deps)),
      ]);

    let diagramMmd: string | null = null;
    let diagramError: string | undefined;
    if (diagramResult) {
      diagramMmd = diagramResult.mmd;
      if (diagramResult.error) {
        diagramError = diagramResult.error;
        errors.push({
          artifact: "diagram",
          code: "mermaid_failed",
          message: diagramResult.error,
        });
      }
    }

    // Required artifacts for a useful bundle: bom, datamodel, failures, estimate.
    if (!bom || !datamodel || !failures || !estimate) {
      throw new StageError(
        "4",
        "artifacts_incomplete",
        "one or more required Stage 4 artifacts failed",
      );
    }

    // ---- Stage 5 — critique + conditional rewrite ----
    let critiqueResult: Critique | undefined;
    const initialBundle: BundleArtifacts = {
      stack,
      bom,
      diagram_mmd: diagramMmd,
      datamodel,
      failures,
      estimate,
      errors,
    };

    let finalStack = stack;
    let finalBom = bom;
    let finalDatamodel = datamodel;
    let finalFailures = failures;
    let finalEstimate = estimate;
    let finalDiagramMmd = diagramMmd;

    try {
      critiqueResult = await critiqueArtifacts(
        { bundle: initialBundle, blueprint: revisedBlueprint },
        deps,
      );

      const targets = new Set<ArtifactId>(critiqueResult.rewrite_targets);
      const defectsByArtifact = new Map<ArtifactId, Defect[]>();
      for (const r of critiqueResult.reviews) {
        if (targets.has(r.artifact_id) && r.defects.length > 0) {
          defectsByArtifact.set(r.artifact_id, r.defects);
        }
      }

      // Run rewrites in parallel; on failure for any one, keep the original.
      const rewrites = await Promise.all(
        Array.from(defectsByArtifact.entries()).map(
          async ([artifactId, defects]) => {
            try {
              const original =
                artifactId === "stack"
                  ? finalStack
                  : artifactId === "bom"
                    ? finalBom
                    : artifactId === "datamodel"
                      ? finalDatamodel
                      : artifactId === "failures"
                        ? finalFailures
                        : artifactId === "estimate"
                          ? finalEstimate
                          : finalDiagramMmd;
              const rewritten = await rewriteArtifact(
                {
                  artifactId,
                  defects,
                  blueprint: revisedBlueprint,
                  pattern,
                  patternDoc,
                  stackJson,
                  original,
                },
                deps,
              );
              return { artifactId, rewritten };
            } catch (err) {
              errors.push({
                artifact: artifactId,
                code: "rewrite_failed",
                message: err instanceof Error ? err.message : String(err),
              });
              return null;
            }
          },
        ),
      );

      for (const r of rewrites) {
        if (!r) continue;
        switch (r.artifactId) {
          case "stack":
            finalStack = r.rewritten as StackRec;
            break;
          case "bom":
            finalBom = r.rewritten as BoM;
            break;
          case "datamodel":
            finalDatamodel = r.rewritten as DataModel;
            break;
          case "failures":
            finalFailures = r.rewritten as FailureCard[];
            break;
          case "estimate":
            finalEstimate = r.rewritten as EstimatePlan;
            break;
          case "diagram": {
            const dr = r.rewritten as { mmd: string | null; error?: string };
            if (dr.mmd) {
              finalDiagramMmd = dr.mmd;
              diagramError = undefined;
            } else if (dr.error) {
              diagramError = dr.error;
            }
            break;
          }
        }
      }
    } catch (err) {
      // Critique failure is non-blocking per Luke §5b.
      errors.push({
        artifact: "stack", // generic placeholder; manifest captures origin
        code: "critique_skipped",
        message: err instanceof Error ? err.message : String(err),
      });
      critiqueResult = undefined;
    }

    const bundle: BundleResult = {
      stack: finalStack,
      bom: finalBom,
      diagram_mmd: finalDiagramMmd,
      datamodel: finalDatamodel,
      failures: finalFailures,
      estimate: finalEstimate,
    };

    const usage = budget.snapshot();
    const manifest: BundleManifest = {
      schema_version: 1,
      bundle_version: 1,
      generated_at: new Date().toISOString(),
      spec_hash: specHash,
      model_id: models.MODEL_GEN,
      pattern,
      blueprint: revisedBlueprint,
      files: FILES_LIST.filter((f) => {
        if (f === "diagram.mmd") return !!finalDiagramMmd;
        return true;
      }),
      errors,
      critique: critiqueResult,
      diagram_error: diagramError,
      usage: {
        total_usd: usage.totalUsd,
        total_output_tokens: usage.totalOutputTokens,
        entries: usage.entries.map((e) => ({
          stage: e.stage,
          model: e.model,
          freshInputTokens: e.freshInputTokens,
          cachedInputTokens: e.cachedInputTokens,
          outputTokens: e.outputTokens,
          usd: e.usd,
        })),
      },
    };

    return {
      status: "ok",
      bundle,
      blueprint: revisedBlueprint,
      manifest,
      specHash,
    };
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return {
        status: "error",
        code: "budget_exceeded",
        details: err.message,
        specHash,
      };
    }
    if (err instanceof ValidationError) {
      return {
        status: "error",
        code: "validation_failed",
        details: err.message,
        specHash,
      };
    }
    if (err instanceof BudgetError) {
      return {
        status: "error",
        code: "spec_too_large",
        details: err.message,
        specHash,
      };
    }
    if (err instanceof StageError) {
      return {
        status: "error",
        code: err.code,
        details: err.message,
        specHash,
      };
    }
    return {
      status: "error",
      code: "unexpected",
      details: err instanceof Error ? err.message : String(err),
      specHash,
    };
  }
}
