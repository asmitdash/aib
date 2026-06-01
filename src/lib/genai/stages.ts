import "server-only";

import type { Schema } from "@google/genai";
import { ZodError, type ZodTypeAny, type infer as ZInfer } from "zod";

import type { BudgetTracker } from "./budget";
import type { AibCaches } from "./cache";
import type { ModelIds } from "./client";
import { StageError } from "./errors";
import { validateMermaid } from "./mermaid-validate";
import type { LLMCallOpts, LLMProvider } from "./providers/types";
import { PARSE_SYSTEM, buildParseUser } from "./prompts/parse";
import { QUESTIONS_SYSTEM, buildQuestionsUser } from "./prompts/questions";
import { FOLD_SYSTEM, buildFoldUser } from "./prompts/fold";
import { getPatternSystem, buildPatternUser } from "./prompts/pattern";
import { STACK_SYSTEM, buildStackUser } from "./prompts/stack";
import { BOM_SYSTEM, buildBoMUser } from "./prompts/bom";
import { DIAGRAM_SYSTEM, buildDiagramUser } from "./prompts/diagram";
import {
  DATAMODEL_SYSTEM,
  buildDataModelUser,
} from "./prompts/datamodel";
import { FAILURES_SYSTEM, buildFailuresUser } from "./prompts/failures";
import { ESTIMATE_SYSTEM, buildEstimateUser } from "./prompts/estimate";
import { CRITIQUE_SYSTEM, buildCritiqueUser } from "./prompts/critique";
import { buildRewriteAppendix } from "./prompts/rewrite";
import { BlueprintIRSchema, BlueprintZ, type Blueprint } from "./schemas/blueprint";
import {
  QuestionSetSchema,
  QuestionSetZ,
  type QuestionSet,
  type QAPair,
} from "./schemas/questions";
import { PatternPickSchema, PatternPickZ, type PatternPick } from "./schemas/pattern-pick";
import { StackRecSchema, StackRecZ, type StackRec } from "./schemas/stack";
import { BoMSchema, BoMZ, type BoM } from "./schemas/bom";
import { DataModelSchema, DataModelZ, type DataModel } from "./schemas/datamodel";
import { FailuresSchema, FailuresZ, type FailureCard } from "./schemas/failures";
import {
  EstimatePlanSchema,
  EstimatePlanZ,
  type EstimatePlan,
} from "./schemas/estimate-plan";
import {
  CritiqueSchema,
  CritiqueZ,
  type ArtifactId,
  type Critique,
  type Defect,
} from "./schemas/critique";

export interface GenAIDeps {
  provider: LLMProvider;
  models: ModelIds;
  specHash: string;
  budget: BudgetTracker;
  caches: AibCaches;
  signal?: AbortSignal;
}

export type Stage4Input = {
  blueprint: Blueprint;
  pattern: PatternPick;
  patternDoc: string;
  stackJson?: string; // serialized stack for downstream artifacts
};

export interface BundleArtifacts {
  stack: StackRec;
  bom: BoM;
  diagram_mmd: string | null;
  datamodel: DataModel;
  failures: FailureCard[];
  estimate: EstimatePlan;
  errors: BundleArtifactError[];
}

export interface BundleArtifactError {
  artifact: ArtifactId | "diagram";
  code: string;
  message: string;
}

interface CommonCallParams {
  stage: string;
  model: string;
  systemInstruction: string;
  userText: string;
  temperature: number;
  maxOutputTokens: number;
  cachedContent?: string | null;
  thinkingBudget?: number;
}

interface StructuredCallParams<TZ extends ZodTypeAny> extends CommonCallParams {
  /** Gemini-native schema (preferred for the Gemini path). */
  geminiSchema: Schema;
  /** Zod schema (canonical; used for validation + non-Gemini providers). */
  zod: TZ;
}

function toLLMOpts<T>(
  deps: GenAIDeps,
  params: CommonCallParams,
  responseSchema?: ZodTypeAny,
  geminiSchema?: unknown,
): LLMCallOpts<T> {
  return {
    stage: params.stage,
    model: params.model,
    systemPrompt: params.systemInstruction,
    userPrompt: params.userText,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    responseSchema,
    geminiSchema,
    cachedContent: params.cachedContent ?? null,
    thinkingBudget: params.thinkingBudget,
    signal: deps.signal,
  };
}

async function rawTextCall(
  deps: GenAIDeps,
  params: CommonCallParams,
): Promise<string> {
  let result;
  try {
    result = await deps.provider.callText(toLLMOpts<string>(deps, params));
  } catch (err) {
    if (err instanceof StageError) throw err;
    throw new StageError(
      params.stage,
      "api_error",
      err instanceof Error ? err.message : String(err),
      err,
    );
  }
  deps.budget.track(params.stage, params.model, {
    freshInputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens,
  });
  return result.output;
}

async function rawJsonCall<T>(
  deps: GenAIDeps,
  params: StructuredCallParams<ZodTypeAny>,
): Promise<T> {
  let result;
  try {
    result = await deps.provider.callJSON<T>(
      toLLMOpts<T>(deps, params, params.zod, params.geminiSchema),
    );
  } catch (err) {
    if (err instanceof StageError) throw err;
    throw new StageError(
      params.stage,
      "api_error",
      err instanceof Error ? err.message : String(err),
      err,
    );
  }
  deps.budget.track(params.stage, params.model, {
    freshInputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens,
  });
  return result.output;
}

async function structuredCall<TZ extends ZodTypeAny>(
  deps: GenAIDeps,
  params: StructuredCallParams<TZ>,
  retryUserBuilder: (lastError: string) => string,
): Promise<ZInfer<TZ>> {
  const attempt = async (
    userText: string,
  ): Promise<{ value: ZInfer<TZ> } | { error: string }> => {
    let raw: unknown;
    try {
      raw = await rawJsonCall<unknown>(deps, { ...params, userText });
    } catch (err) {
      if (err instanceof StageError) return { error: err.message };
      throw err;
    }
    const result = params.zod.safeParse(raw);
    if (!result.success) {
      return {
        error: `Zod validation failed: ${formatZodError(result.error)}`,
      };
    }
    return { value: result.data as ZInfer<TZ> };
  };

  const first = await attempt(params.userText);
  if ("value" in first) return first.value;

  const retryText = retryUserBuilder(first.error);
  const second = await attempt(retryText);
  if ("value" in second) return second.value;

  throw new StageError(
    params.stage,
    "validation_failed_after_retry",
    `${first.error} | retry: ${second.error}`,
  );
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .slice(0, 5)
    .join("; ");
}

// ---------- Stage 1 — parseSpec ----------

export async function parseSpec(
  input: { wrappedSpec: string },
  deps: GenAIDeps,
): Promise<Blueprint> {
  return structuredCall(
    deps,
    {
      stage: "1.parse",
      model: deps.models.MODEL_GEN,
      systemInstruction: PARSE_SYSTEM,
      userText: buildParseUser(input.wrappedSpec),
      temperature: 0.2,
      maxOutputTokens: 4000,
      thinkingBudget: 2048,
      geminiSchema: BlueprintIRSchema as Schema,
      zod: BlueprintZ,
    },
    (lastError) => buildParseUser(input.wrappedSpec, lastError),
  );
}

// ---------- Stage 2a — generateQuestions ----------

export async function generateQuestions(
  input: { blueprint: Blueprint; specExcerpt: string },
  deps: GenAIDeps,
): Promise<QuestionSet> {
  const blueprintJson = JSON.stringify(input.blueprint);
  return structuredCall(
    deps,
    {
      stage: "2a.questions",
      model: deps.models.MODEL_FAST,
      systemInstruction: QUESTIONS_SYSTEM,
      userText: buildQuestionsUser(blueprintJson, input.specExcerpt),
      cachedContent: deps.caches.fastCache,
      temperature: 0.4,
      maxOutputTokens: 1500,
      geminiSchema: QuestionSetSchema as Schema,
      zod: QuestionSetZ,
    },
    (lastError) =>
      buildQuestionsUser(blueprintJson, input.specExcerpt, lastError),
  );
}

// ---------- Stage 2b — foldAnswers ----------

export async function foldAnswers(
  input: { blueprint: Blueprint; answers: QAPair[] },
  deps: GenAIDeps,
): Promise<Blueprint> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const qaJson = JSON.stringify(input.answers);
  return structuredCall(
    deps,
    {
      stage: "2b.fold",
      model: deps.models.MODEL_GEN,
      systemInstruction: FOLD_SYSTEM,
      userText: buildFoldUser(blueprintJson, qaJson),
      temperature: 0.2,
      maxOutputTokens: 4000,
      geminiSchema: BlueprintIRSchema as Schema,
      zod: BlueprintZ,
    },
    (lastError) => buildFoldUser(blueprintJson, qaJson, lastError),
  );
}

// ---------- Stage 3 — pickPattern ----------

export async function pickPattern(
  input: { blueprint: Blueprint },
  deps: GenAIDeps,
): Promise<PatternPick> {
  const blueprintJson = JSON.stringify(input.blueprint);
  try {
    return await structuredCall(
      deps,
      {
        stage: "3.pattern",
        model: deps.models.MODEL_FAST,
        systemInstruction: getPatternSystem(),
        userText: buildPatternUser(blueprintJson),
        cachedContent: deps.caches.fastCache,
        temperature: 0.0,
        maxOutputTokens: 400,
        geminiSchema: PatternPickSchema as Schema,
        zod: PatternPickZ,
      },
      (lastError) => buildPatternUser(blueprintJson, lastError),
    );
  } catch {
    // Per Luke: fall back to crud-saas as the safest substrate; log via
    // returned object so the orchestrator can mark a manifest.error.
    return {
      pattern: "crud-saas",
      confidence: 0.3,
      runner_up: null,
      reasoning: "fallback after classifier failure",
    };
  }
}

// ---------- Stage 4 helpers ----------

export async function generateStack(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<StackRec> {
  const blueprintJson = JSON.stringify(input.blueprint);
  return structuredCall(
    deps,
    {
      stage: "4.1.stack",
      model: deps.models.MODEL_GEN,
      systemInstruction: STACK_SYSTEM,
      userText: buildStackUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.3,
      maxOutputTokens: 3000,
      geminiSchema: StackRecSchema as Schema,
      zod: StackRecZ,
    },
    (lastError) =>
      buildStackUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        lastError,
      ),
  );
}

export async function generateBoM(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<BoM> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const stackJson = input.stackJson ?? "{}";
  return structuredCall(
    deps,
    {
      stage: "4.2.bom",
      model: deps.models.MODEL_GEN,
      systemInstruction: BOM_SYSTEM,
      userText: buildBoMUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.3,
      maxOutputTokens: 2500,
      geminiSchema: BoMSchema as Schema,
      zod: BoMZ,
    },
    (lastError) =>
      buildBoMUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
        lastError,
      ),
  );
}

export async function generateDataModel(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<DataModel> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const stackJson = input.stackJson ?? "{}";
  return structuredCall(
    deps,
    {
      stage: "4.4.datamodel",
      model: deps.models.MODEL_GEN,
      systemInstruction: DATAMODEL_SYSTEM,
      userText: buildDataModelUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.2,
      maxOutputTokens: 4000,
      geminiSchema: DataModelSchema as Schema,
      zod: DataModelZ,
    },
    (lastError) =>
      buildDataModelUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
        lastError,
      ),
  );
}

export async function generateFailures(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<FailureCard[]> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const stackJson = input.stackJson ?? "{}";
  const result = await structuredCall(
    deps,
    {
      stage: "4.5.failures",
      model: deps.models.MODEL_GEN,
      systemInstruction: FAILURES_SYSTEM,
      userText: buildFailuresUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.4,
      maxOutputTokens: 3000,
      geminiSchema: FailuresSchema as Schema,
      zod: FailuresZ,
    },
    (lastError) =>
      buildFailuresUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
        lastError,
      ),
  );
  return result.cards;
}

export async function generateEstimate(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<EstimatePlan> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const stackJson = input.stackJson ?? "{}";
  return structuredCall(
    deps,
    {
      stage: "4.6.estimate",
      model: deps.models.MODEL_GEN,
      systemInstruction: ESTIMATE_SYSTEM,
      userText: buildEstimateUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.3,
      maxOutputTokens: 3000,
      geminiSchema: EstimatePlanSchema as Schema,
      zod: EstimatePlanZ,
    },
    (lastError) =>
      buildEstimateUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
        lastError,
      ),
  );
}

// ---------- Stage 4.3 — diagram (plain text + Mermaid validate + retry) ----------

export async function generateDiagram(
  input: Stage4Input,
  deps: GenAIDeps,
): Promise<{ mmd: string | null; error?: string }> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const stackJson = input.stackJson ?? "{}";

  const callOnce = async (lastError?: string): Promise<string> => {
    const text = await rawTextCall(deps, {
      stage: "4.3.diagram",
      model: deps.models.MODEL_GEN,
      systemInstruction: DIAGRAM_SYSTEM,
      userText: buildDiagramUser(
        blueprintJson,
        input.pattern.pattern,
        input.patternDoc,
        stackJson,
        lastError,
      ),
      cachedContent: deps.caches.genCache,
      temperature: 0.2,
      maxOutputTokens: 2000,
    });
    return text
      .trim()
      .replace(/^```(?:mermaid)?\s*/i, "")
      .replace(/```$/, "")
      .trim();
  };

  try {
    const first = await callOnce();
    const v1 = await validateMermaid(first);
    if (v1.ok) return { mmd: first };
    const second = await callOnce(v1.error);
    const v2 = await validateMermaid(second);
    if (v2.ok) return { mmd: second };
    return { mmd: null, error: v2.error };
  } catch (err) {
    return {
      mmd: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------- Stage 5 — critique + rewrite ----------

export async function critique(
  input: { bundle: BundleArtifacts; blueprint: Blueprint },
  deps: GenAIDeps,
): Promise<Critique> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const bundleJson = JSON.stringify({
    stack: input.bundle.stack,
    bom: input.bundle.bom,
    diagram: input.bundle.diagram_mmd,
    datamodel: input.bundle.datamodel,
    failures: input.bundle.failures,
    estimate: input.bundle.estimate,
  });
  return structuredCall(
    deps,
    {
      stage: "5a.critique",
      model: deps.models.MODEL_CRITIC,
      systemInstruction: CRITIQUE_SYSTEM,
      userText: buildCritiqueUser(blueprintJson, bundleJson),
      temperature: 0.4,
      maxOutputTokens: 3000,
      geminiSchema: CritiqueSchema as Schema,
      zod: CritiqueZ,
    },
    (lastError) => buildCritiqueUser(blueprintJson, bundleJson, lastError),
  );
}

export interface RewriteInput {
  artifactId: ArtifactId;
  defects: Defect[];
  blueprint: Blueprint;
  pattern: PatternPick;
  patternDoc: string;
  stackJson: string;
  original: unknown;
}

export async function rewriteArtifact(
  input: RewriteInput,
  deps: GenAIDeps,
): Promise<unknown> {
  const blueprintJson = JSON.stringify(input.blueprint);
  const defectsJson = JSON.stringify(input.defects);
  const appendix = buildRewriteAppendix(defectsJson);

  switch (input.artifactId) {
    case "stack": {
      const userText =
        buildStackUser(blueprintJson, input.pattern.pattern, input.patternDoc) +
        appendix;
      return structuredCall(
        deps,
        {
          stage: "5b.rewrite.stack",
          model: deps.models.MODEL_CRITIC,
          systemInstruction: STACK_SYSTEM,
          userText,
          temperature: 0.3,
          maxOutputTokens: 3000,
          geminiSchema: StackRecSchema as Schema,
          zod: StackRecZ,
        },
        (lastError) =>
          buildStackUser(
            blueprintJson,
            input.pattern.pattern,
            input.patternDoc,
            lastError,
          ) + appendix,
      );
    }
    case "bom": {
      const userText =
        buildBoMUser(
          blueprintJson,
          input.pattern.pattern,
          input.patternDoc,
          input.stackJson,
        ) + appendix;
      return structuredCall(
        deps,
        {
          stage: "5b.rewrite.bom",
          model: deps.models.MODEL_CRITIC,
          systemInstruction: BOM_SYSTEM,
          userText,
          temperature: 0.3,
          maxOutputTokens: 2500,
          geminiSchema: BoMSchema as Schema,
          zod: BoMZ,
        },
        (lastError) =>
          buildBoMUser(
            blueprintJson,
            input.pattern.pattern,
            input.patternDoc,
            input.stackJson,
            lastError,
          ) + appendix,
      );
    }
    case "datamodel": {
      const userText =
        buildDataModelUser(
          blueprintJson,
          input.pattern.pattern,
          input.patternDoc,
          input.stackJson,
        ) + appendix;
      return structuredCall(
        deps,
        {
          stage: "5b.rewrite.datamodel",
          model: deps.models.MODEL_CRITIC,
          systemInstruction: DATAMODEL_SYSTEM,
          userText,
          temperature: 0.2,
          maxOutputTokens: 4000,
          geminiSchema: DataModelSchema as Schema,
          zod: DataModelZ,
        },
        (lastError) =>
          buildDataModelUser(
            blueprintJson,
            input.pattern.pattern,
            input.patternDoc,
            input.stackJson,
            lastError,
          ) + appendix,
      );
    }
    case "failures": {
      const userText =
        buildFailuresUser(
          blueprintJson,
          input.pattern.pattern,
          input.patternDoc,
          input.stackJson,
        ) + appendix;
      const result = await structuredCall(
        deps,
        {
          stage: "5b.rewrite.failures",
          model: deps.models.MODEL_CRITIC,
          systemInstruction: FAILURES_SYSTEM,
          userText,
          temperature: 0.4,
          maxOutputTokens: 3000,
          geminiSchema: FailuresSchema as Schema,
          zod: FailuresZ,
        },
        (lastError) =>
          buildFailuresUser(
            blueprintJson,
            input.pattern.pattern,
            input.patternDoc,
            input.stackJson,
            lastError,
          ) + appendix,
      );
      return result.cards;
    }
    case "estimate": {
      const userText =
        buildEstimateUser(
          blueprintJson,
          input.pattern.pattern,
          input.patternDoc,
          input.stackJson,
        ) + appendix;
      return structuredCall(
        deps,
        {
          stage: "5b.rewrite.estimate",
          model: deps.models.MODEL_CRITIC,
          systemInstruction: ESTIMATE_SYSTEM,
          userText,
          temperature: 0.3,
          maxOutputTokens: 3000,
          geminiSchema: EstimatePlanSchema as Schema,
          zod: EstimatePlanZ,
        },
        (lastError) =>
          buildEstimateUser(
            blueprintJson,
            input.pattern.pattern,
            input.patternDoc,
            input.stackJson,
            lastError,
          ) + appendix,
      );
    }
    case "diagram": {
      const stage4: Stage4Input = {
        blueprint: input.blueprint,
        pattern: input.pattern,
        patternDoc:
          input.patternDoc +
          "\n\nDefects from review:\n" +
          defectsJson,
        stackJson: input.stackJson,
      };
      const r = await generateDiagram(stage4, deps);
      return r;
    }
  }
}
