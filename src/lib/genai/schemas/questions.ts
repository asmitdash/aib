import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const QuestionSetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "q1, q2, ..." },
          kind: {
            type: Type.STRING,
            enum: [
              "scale",
              "compliance",
              "auth",
              "sync_async",
              "budget",
              "other",
            ],
          },
          text: { type: Type.STRING, description: "<= 20 words" },
          why_it_matters: {
            type: Type.STRING,
            description: "<= 80 chars",
          },
          choices: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Optional MCQ choices; empty for free-text",
          },
        },
        required: ["id", "kind", "text", "why_it_matters"],
        propertyOrdering: ["id", "kind", "text", "why_it_matters", "choices"],
      },
    },
  },
  required: ["questions"],
};

export const QuestionZ = z.object({
  id: z.string(),
  kind: z.enum(["scale", "compliance", "auth", "sync_async", "budget", "other"]),
  text: z.string(),
  why_it_matters: z.string(),
  choices: z.array(z.string()).optional(),
});

export const QuestionSetZ = z.object({
  questions: z.array(QuestionZ),
});

export type Question = z.infer<typeof QuestionZ>;
export type QuestionSet = z.infer<typeof QuestionSetZ>;

export const QAPairZ = z.object({
  id: z.string(),
  answer: z.string(),
});
export type QAPair = z.infer<typeof QAPairZ>;
