import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { copySource, prepareWorkspace } from "@elfish/workspace";
import type { WorkspaceHandle } from "@elfish/workspace";

import { commandNode } from "./command";
import { defineNode } from "../define";
import { runNode } from "../testing/harness";
import { fail, ok, schema } from "../testing/schema";

const tempRoots: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

async function preparedWorkspace(): Promise<WorkspaceHandle> {
  const rootDir = await tempDir("elfish-nodes-ws-");
  const source = await tempDir("elfish-nodes-src-");
  await writeFile(join(source, "README.md"), "command node test\n");
  return prepareWorkspace({ rootDir, source: copySource({ from: source }) });
}

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const stringSchema = schema<string>((value) =>
  typeof value === "string" ? ok(value) : fail("expected a string"),
);
const noInput = schema<undefined>(() => ok(undefined));
const noParams = schema<undefined>(() => ok(undefined));

function bunScriptNode(script: string) {
  return commandNode<undefined, undefined, string>({
    name: "bun-script",
    input: noInput,
    params: noParams,
    output: stringSchema,
    // Absolute path: the dispatcher does not inherit the CLI's PATH.
    buildCommand: () => ({ program: process.execPath, args: ["-e", script] }),
    mapResult: (result) => ({
      status: "completed",
      output: result.stdout.trim(),
    }),
  });
}

describe("commandNode", () => {
  test("dispatches a real command and maps stdout to output", async () => {
    const workspace = await preparedWorkspace();
    const node = bunScriptNode('process.stdout.write("hello from node")');

    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result).toEqual({ status: "completed", output: "hello from node" });
  });

  test("fails with COMMAND_FAILED on a non-zero exit", async () => {
    const workspace = await preparedWorkspace();
    const node = bunScriptNode("process.exit(2)");

    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("COMMAND_FAILED");
  });

  test("fails when the program is unavailable", async () => {
    const workspace = await preparedWorkspace();
    const node = commandNode<undefined, undefined, string>({
      name: "missing",
      input: noInput,
      params: noParams,
      output: stringSchema,
      buildCommand: () => ({ program: "definitely-not-a-real-program-xyz" }),
      mapResult: (result) => ({ status: "completed", output: result.stdout }),
    });

    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("COMMAND_UNAVAILABLE");
  });

  test("fails fast with MISSING_CAPABILITY when dispatch is unavailable", async () => {
    const node = bunScriptNode('console.log("never runs")');
    // No workspace => the runtime cannot satisfy the declared "dispatch" capability.
    const result = await runNode(node, undefined, undefined, {});
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("MISSING_CAPABILITY");
  });
});

describe("capability gating", () => {
  test("an undeclared node is not given ctx.dispatch even when one is available", async () => {
    const workspace = await preparedWorkspace();
    // Declares no capabilities, yet reaches for dispatch.
    const sneaky = defineNode<undefined, undefined, string>({
      name: "sneaky",
      capabilities: [],
      input: noInput,
      params: noParams,
      output: stringSchema,
      async run(_input, _params, ctx) {
        if (!ctx.dispatch) {
          return {
            status: "failed",
            error: {
              code: "MISSING_CAPABILITY",
              message: "no dispatch on ctx",
            },
          };
        }
        const result = await ctx.dispatch({ program: "bun", args: ["-e", ""] });
        return { status: "completed", output: result.stdout };
      },
    });

    const result = await runNode(sneaky, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("MISSING_CAPABILITY");
  });
});
