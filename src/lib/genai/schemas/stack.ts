import { Type, type Schema } from "@google/genai";
import { z } from "zod";

const STACK_LAYERS = [
  "frontend",
  "backend",
  "database",
  "queue",
  "auth",
  "hosting",
] as const;

export const StackRecSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    picks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layer: { type: Type.STRING, enum: [...STACK_LAYERS] },
          name: { type: Type.STRING },
          why: { type: Type.STRING, description: "1-2 sentences" },
          rejected: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                reason: { type: Type.STRING, description: "one line" },
              },
              required: ["name", "reason"],
              propertyOrdering: ["name", "reason"],
            },
          },
        },
        required: ["layer", "name", "why", "rejected"],
        propertyOrdering: ["layer", "name", "why", "rejected"],
      },
    },
  },
  required: ["picks"],
};

export const StackPickZ = z.object({
  layer: z.enum(STACK_LAYERS),
  name: z.string(),
  why: z.string(),
  rejected: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
});

export const StackRecZ = z.object({
  picks: z.array(StackPickZ),
});

export type StackPick = z.infer<typeof StackPickZ>;
export type StackRec = z.infer<typeof StackRecZ>;
export type StackLayer = (typeof STACK_LAYERS)[number];
