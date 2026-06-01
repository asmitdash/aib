import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { PATTERN_IDS } from "../reference-library";

export const PatternPickSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    pattern: { type: Type.STRING, enum: [...PATTERN_IDS] },
    confidence: { type: Type.NUMBER },
    runner_up: { type: Type.STRING, enum: ["", ...PATTERN_IDS] },
    reasoning: { type: Type.STRING, description: "<= 200 chars" },
  },
  required: ["pattern", "confidence", "reasoning"],
  propertyOrdering: ["pattern", "confidence", "runner_up", "reasoning"],
};

export const PatternPickZ = z.object({
  pattern: z.enum(PATTERN_IDS),
  confidence: z.number().min(0).max(1),
  runner_up: z.string().nullable().optional(),
  reasoning: z.string(),
});

export type PatternPick = z.infer<typeof PatternPickZ>;
