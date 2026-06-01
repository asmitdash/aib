import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const BlueprintIRSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "kebab-case, <= 32 chars" },
          description: { type: Type.STRING },
          attributes: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "description"],
        propertyOrdering: ["name", "description", "attributes"],
      },
    },
    flows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          actor: { type: Type.STRING, description: "user role or system" },
          trigger: {
            type: Type.STRING,
            enum: ["sync", "async", "scheduled", "event"],
          },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "actor", "steps", "trigger"],
        propertyOrdering: ["name", "actor", "trigger", "steps"],
      },
    },
    external_services: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          purpose: { type: Type.STRING },
          required: { type: Type.BOOLEAN },
        },
        required: ["name", "purpose", "required"],
        propertyOrdering: ["name", "purpose", "required"],
      },
    },
    constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
    nonfunctional: {
      type: Type.OBJECT,
      properties: {
        scale: { type: Type.STRING, description: "e.g. '1000 DAU', 'unknown'" },
        latency: { type: Type.STRING },
        compliance: { type: Type.ARRAY, items: { type: Type.STRING } },
        availability: { type: Type.STRING },
      },
      propertyOrdering: ["scale", "latency", "availability", "compliance"],
    },
  },
  required: [
    "entities",
    "flows",
    "external_services",
    "constraints",
    "nonfunctional",
  ],
  propertyOrdering: [
    "entities",
    "flows",
    "external_services",
    "constraints",
    "nonfunctional",
  ],
};

export const BlueprintZ = z.object({
  entities: z.array(
    z.object({
      name: z
        .string()
        .max(48)
        .regex(/^[a-z0-9-]+$/, "must be kebab-case"),
      description: z.string(),
      attributes: z.array(z.string()).optional(),
    }),
  ),
  flows: z.array(
    z.object({
      name: z.string(),
      actor: z.string(),
      trigger: z.enum(["sync", "async", "scheduled", "event"]),
      steps: z.array(z.string()),
    }),
  ),
  external_services: z.array(
    z.object({
      name: z.string(),
      purpose: z.string(),
      required: z.boolean(),
    }),
  ),
  constraints: z.array(z.string()),
  nonfunctional: z.object({
    scale: z.string().optional(),
    latency: z.string().optional(),
    compliance: z.array(z.string()).optional(),
    availability: z.string().optional(),
  }),
});

export type Blueprint = z.infer<typeof BlueprintZ>;
