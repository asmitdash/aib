import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const FailuresSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          trigger: { type: Type.STRING },
          blast_radius: { type: Type.STRING },
          detection: { type: Type.STRING },
          mitigation: { type: Type.STRING },
        },
        required: [
          "title",
          "trigger",
          "blast_radius",
          "detection",
          "mitigation",
        ],
        propertyOrdering: [
          "title",
          "trigger",
          "blast_radius",
          "detection",
          "mitigation",
        ],
      },
    },
  },
  required: ["cards"],
};

export const FailureCardZ = z.object({
  title: z.string(),
  trigger: z.string(),
  blast_radius: z.string(),
  detection: z.string(),
  mitigation: z.string(),
});

export const FailuresZ = z.object({
  cards: z.array(FailureCardZ),
});

export type FailureCard = z.infer<typeof FailureCardZ>;
export type Failures = z.infer<typeof FailuresZ>;
