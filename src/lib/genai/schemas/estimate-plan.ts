import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const EstimatePlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    monthly_infra_usd: {
      type: Type.OBJECT,
      properties: {
        low: { type: Type.NUMBER },
        expected: { type: Type.NUMBER },
        high: { type: Type.NUMBER },
      },
      required: ["low", "expected", "high"],
      propertyOrdering: ["low", "expected", "high"],
    },
    engineer_weeks: {
      type: Type.OBJECT,
      properties: {
        low: { type: Type.NUMBER },
        expected: { type: Type.NUMBER },
        high: { type: Type.NUMBER },
      },
      required: ["low", "expected", "high"],
      propertyOrdering: ["low", "expected", "high"],
    },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    milestones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "M0, M1, ..." },
          name: { type: Type.STRING },
          week: { type: Type.STRING, description: "e.g. 'Week 1'" },
          deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
          depends_on: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["id", "name", "week", "deliverables", "depends_on"],
        propertyOrdering: [
          "id",
          "name",
          "week",
          "deliverables",
          "depends_on",
        ],
      },
    },
  },
  required: [
    "monthly_infra_usd",
    "engineer_weeks",
    "assumptions",
    "milestones",
  ],
  propertyOrdering: [
    "monthly_infra_usd",
    "engineer_weeks",
    "assumptions",
    "milestones",
  ],
};

const Band = z.object({
  low: z.number(),
  expected: z.number(),
  high: z.number(),
});

export const MilestoneZ = z.object({
  id: z.string(),
  name: z.string(),
  week: z.string(),
  deliverables: z.array(z.string()),
  depends_on: z.array(z.string()),
});

export const EstimatePlanZ = z.object({
  monthly_infra_usd: Band,
  engineer_weeks: Band,
  assumptions: z.array(z.string()),
  milestones: z.array(MilestoneZ),
});

export type Milestone = z.infer<typeof MilestoneZ>;
export type EstimatePlan = z.infer<typeof EstimatePlanZ>;
