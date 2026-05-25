import { describe, expect, test } from "bun:test";

import { defineNode } from "./define";
import type { NodeContext, NodeRunResult } from "./types";
import { fail, ok, object, schema } from "./testing/schema";

const ctx: NodeContext = { signal: new AbortController().signal };

const numberSchema = schema<number>((value) =>
  typeof value === "number" ? ok(value) : fail("expected a number"),
);

const stringSchema = schema<string>((value) =>
  typeof value === "string" ? ok(value) : fail("expected a string"),
);

describe("defineNode boundary validation", () => {
  test("passes validated input/output through on success", async () => {
    const node = defineNode<number, undefined, string>({
      name: "echo",
      capabilities: [],
      input: numberSchema,
      params: schema(() => ok(undefined)),
      output: stringSchema,
      async run(input) {
        return { status: "completed", output: String(input) };
      },
    });

    const result = await node.run(7, undefined, ctx);
    expect(result).toEqual({ status: "completed", output: "7" });
  });

  test("fails with OUTPUT_INVALID when run returns output the schema rejects", async () => {
    const node = defineNode<number, undefined, string>({
      name: "bad-output",
      capabilities: [],
      input: numberSchema,
      params: schema(() => ok(undefined)),
      output: stringSchema,
      async run() {
        // Violates the declared output schema (number, not string).
        return { status: "completed", output: 123 as unknown as string };
      },
    });

    const result = await node.run(1, undefined, ctx);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("OUTPUT_INVALID");
    expect(result.error.issues?.length).toBeGreaterThan(0);
  });

  test("fails with INPUT_INVALID before running when input is malformed", async () => {
    let ran = false;
    const node = defineNode<number, undefined, string>({
      name: "guarded",
      capabilities: [],
      input: numberSchema,
      params: schema(() => ok(undefined)),
      output: stringSchema,
      async run(input) {
        ran = true;
        return { status: "completed", output: String(input) };
      },
    });

    const result = await node.run("nope" as unknown as number, undefined, ctx);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("INPUT_INVALID");
    expect(ran).toBe(false);
  });

  test("does not validate output for suspended/failed results", async () => {
    const node = defineNode<undefined, undefined, string>({
      name: "suspends",
      capabilities: [],
      input: schema(() => ok(undefined)),
      params: schema(() => ok(undefined)),
      output: stringSchema,
      async run(): Promise<NodeRunResult<string>> {
        return { status: "suspended", waitingFor: "thing", state: { a: 1 } };
      },
    });

    const result = await node.run(undefined, undefined, ctx);
    expect(result).toEqual({
      status: "suspended",
      waitingFor: "thing",
      state: { a: 1 },
    });
  });

  test("validates params at the boundary", async () => {
    const node = defineNode<undefined, { mode: string }, string>({
      name: "params",
      capabilities: [],
      input: schema(() => ok(undefined)),
      params: object<{ mode: string }>((value) =>
        typeof value.mode === "string"
          ? ok({ mode: value.mode })
          : fail("mode must be a string"),
      ),
      output: stringSchema,
      async run(_input, params) {
        return { status: "completed", output: params.mode };
      },
    });

    const result = await node.run(
      undefined,
      { mode: 42 } as unknown as { mode: string },
      ctx,
    );
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("PARAMS_INVALID");
  });
});
