import "server-only";

import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[aib] GOOGLE_API_KEY is not set. Refusing to start. Set it in Vercel project env (production + preview) or .env.local for dev.",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

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
