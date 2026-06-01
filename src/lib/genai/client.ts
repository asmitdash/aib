import "server-only";

export interface ModelIds {
  MODEL_GEN: string;
  MODEL_FAST: string;
  MODEL_CRITIC: string;
}

export function getModelIds(): ModelIds {
  const gen = process.env.AIB_MODEL_GENERATION;
  const cls = process.env.AIB_MODEL_CLASSIFICATION;
  if (!gen || !cls) {
    throw new Error(
      "[aib] AIB_MODEL_GENERATION and AIB_MODEL_CLASSIFICATION must be set. No defaults in code.",
    );
  }
  return { MODEL_GEN: gen, MODEL_FAST: cls, MODEL_CRITIC: gen };
}
