import type { z } from "zod";

interface ActionDefinition<TSchema extends z.ZodType, TResult> {
  description: string;
  schema: TSchema;
  readOnly?: boolean;
  http?: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" };
  run: (input: z.infer<TSchema>) => Promise<TResult> | TResult;
}

export function defineAction<TSchema extends z.ZodType, TResult>(
  definition: ActionDefinition<TSchema, TResult>,
) {
  return {
    ...definition,
    async run(input: unknown): Promise<TResult> {
      return await definition.run(definition.schema.parse(input));
    },
  };
}
