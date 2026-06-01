import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const DataModelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "snake_case" },
          columns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                nullable: { type: Type.BOOLEAN },
                default: { type: Type.STRING },
                comment: { type: Type.STRING },
              },
              required: ["name", "type", "nullable"],
              propertyOrdering: [
                "name",
                "type",
                "nullable",
                "default",
                "comment",
              ],
            },
          },
          primary_key: { type: Type.ARRAY, items: { type: Type.STRING } },
          indexes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                columns: { type: Type.ARRAY, items: { type: Type.STRING } },
                unique: { type: Type.BOOLEAN },
              },
              required: ["name", "columns", "unique"],
              propertyOrdering: ["name", "columns", "unique"],
            },
          },
          foreign_keys: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                column: { type: Type.STRING },
                references: {
                  type: Type.STRING,
                  description: "table.column",
                },
                on_delete: { type: Type.STRING },
              },
              required: ["column", "references", "on_delete"],
              propertyOrdering: ["column", "references", "on_delete"],
            },
          },
        },
        required: ["name", "columns", "primary_key", "indexes", "foreign_keys"],
        propertyOrdering: [
          "name",
          "columns",
          "primary_key",
          "indexes",
          "foreign_keys",
        ],
      },
    },
    ddl: {
      type: Type.STRING,
      description: "Postgres CREATE TABLE statements in dependency order",
    },
  },
  required: ["tables", "ddl"],
  propertyOrdering: ["tables", "ddl"],
};

export const DataModelZ = z.object({
  tables: z.array(
    z.object({
      name: z.string(),
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean(),
          default: z.string().optional(),
          comment: z.string().optional(),
        }),
      ),
      primary_key: z.array(z.string()),
      indexes: z.array(
        z.object({
          name: z.string(),
          columns: z.array(z.string()),
          unique: z.boolean(),
        }),
      ),
      foreign_keys: z.array(
        z.object({
          column: z.string(),
          references: z.string(),
          on_delete: z.string(),
        }),
      ),
    }),
  ),
  ddl: z.string(),
});

export type DataModel = z.infer<typeof DataModelZ>;
