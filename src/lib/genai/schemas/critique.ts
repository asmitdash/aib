import { Type, type Schema } from "@google/genai";
import { z } from "zod";

const ARTIFACT_IDS = [
  "stack",
  "bom",
  "diagram",
  "datamodel",
  "failures",
  "estimate",
] as const;

export const CritiqueSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reviews: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          artifact_id: { type: Type.STRING, enum: [...ARTIFACT_IDS] },
          scores: {
            type: Type.OBJECT,
            properties: {
              correctness: { type: Type.INTEGER },
              specificity: { type: Type.INTEGER },
              consistency: { type: Type.INTEGER },
            },
            required: ["correctness", "specificity", "consistency"],
            propertyOrdering: ["correctness", "specificity", "consistency"],
          },
          defects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                problem: { type: Type.STRING },
                fix: { type: Type.STRING },
              },
              required: ["quote", "problem", "fix"],
              propertyOrdering: ["quote", "problem", "fix"],
            },
          },
        },
        required: ["artifact_id", "scores", "defects"],
        propertyOrdering: ["artifact_id", "scores", "defects"],
      },
    },
    rewrite_targets: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: [...ARTIFACT_IDS] },
    },
  },
  required: ["reviews", "rewrite_targets"],
  propertyOrdering: ["reviews", "rewrite_targets"],
};

export const DefectZ = z.object({
  quote: z.string(),
  problem: z.string(),
  fix: z.string(),
});

export const ArtifactReviewZ = z.object({
  artifact_id: z.enum(ARTIFACT_IDS),
  scores: z.object({
    correctness: z.number().int(),
    specificity: z.number().int(),
    consistency: z.number().int(),
  }),
  defects: z.array(DefectZ),
});

export const CritiqueZ = z.object({
  reviews: z.array(ArtifactReviewZ),
  rewrite_targets: z.array(z.enum(ARTIFACT_IDS)),
});

export type ArtifactId = (typeof ARTIFACT_IDS)[number];
export type Defect = z.infer<typeof DefectZ>;
export type ArtifactReview = z.infer<typeof ArtifactReviewZ>;
export type Critique = z.infer<typeof CritiqueZ>;

export const ARTIFACT_ID_LIST = ARTIFACT_IDS;
