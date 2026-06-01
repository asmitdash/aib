import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const BoMSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          kind: { type: Type.STRING, enum: ["saas", "npm", "infra"] },
          tier: { type: Type.STRING, description: "pricing tier or 'free'" },
          monthly_cost_usd_low: { type: Type.NUMBER },
          monthly_cost_usd_high: { type: Type.NUMBER },
          license: { type: Type.STRING },
          why: { type: Type.STRING },
        },
        required: [
          "name",
          "kind",
          "tier",
          "monthly_cost_usd_low",
          "monthly_cost_usd_high",
          "license",
          "why",
        ],
        propertyOrdering: [
          "name",
          "kind",
          "tier",
          "monthly_cost_usd_low",
          "monthly_cost_usd_high",
          "license",
          "why",
        ],
      },
    },
  },
  required: ["items"],
};

export const BoMItemZ = z.object({
  name: z.string(),
  kind: z.enum(["saas", "npm", "infra"]),
  tier: z.string(),
  monthly_cost_usd_low: z.number(),
  monthly_cost_usd_high: z.number(),
  license: z.string(),
  why: z.string(),
});

export const BoMZ = z.object({
  items: z.array(BoMItemZ),
});

export type BoMItem = z.infer<typeof BoMItemZ>;
export type BoM = z.infer<typeof BoMZ>;
