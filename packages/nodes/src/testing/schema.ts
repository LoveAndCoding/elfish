import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "@elfish/types/schema";

// Minimal real Standard Schema objects for tests. Not mocks: these implement the
// vendor-agnostic interface the same way a schema library would, so nodes validate
// against genuine schemas rather than test doubles.

export function ok<T>(value: T): StandardSchemaV1.Result<T> {
  return { value };
}

export function fail(...messages: string[]): StandardSchemaV1.Result<never> {
  return { issues: messages.map((message) => ({ message })) };
}

export function schema<Output>(
  validate: (value: unknown) => StandardSchemaV1.Result<Output>,
): StandardSchemaV1<unknown, Output> {
  return { "~standard": { version: 1, vendor: "elfish-test", validate } };
}

/** A schema that both validates and exposes a JSON Schema (as real agent-output schemas do). */
export function jsonSchema<Output>(
  validate: (value: unknown) => StandardSchemaV1.Result<Output>,
  jsonSchemaObject: Record<string, unknown>,
): StandardSchemaV1<unknown, Output> & StandardJSONSchemaV1<unknown, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: "elfish-test",
      validate,
      jsonSchema: {
        input: () => jsonSchemaObject,
        output: () => jsonSchemaObject,
      },
    },
  };
}

/** Accepts anything as-is. */
export const anySchema: StandardSchemaV1<unknown, unknown> = schema((value) =>
  ok(value),
);

export function object<Output>(
  validate: (value: Record<string, unknown>) => StandardSchemaV1.Result<Output>,
): StandardSchemaV1<unknown, Output> {
  return schema((value) =>
    typeof value === "object" && value !== null
      ? validate(value as Record<string, unknown>)
      : fail("expected an object"),
  );
}
