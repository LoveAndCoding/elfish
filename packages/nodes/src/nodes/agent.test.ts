import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { copySource, prepareWorkspace } from "@elfish/workspace";
import type { WorkspaceHandle } from "@elfish/workspace";

import { agentNode } from "./agent";
import type { AgentOutputSchema } from "./agent";
import { runNode } from "../testing/harness";
import { fail, jsonSchema, ok, schema } from "../testing/schema";

const tempRoots: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

async function preparedWorkspace(): Promise<WorkspaceHandle> {
  const rootDir = await tempDir("elfish-agent-ws-");
  const source = await tempDir("elfish-agent-src-");
  await writeFile(join(source, "README.md"), "agent node test\n");
  return prepareWorkspace({ rootDir, source: copySource({ from: source }) });
}

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

type Answer = { answer: string };

const ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
} as const;

// Real schema: validates {answer: string} AND projects to JSON Schema, like a schema library.
const answerSchema: AgentOutputSchema<Answer> = jsonSchema<Answer>(
  (value) => {
    if (typeof value !== "object" || value === null)
      return fail("expected an object");
    const record = value as Record<string, unknown>;
    return typeof record.answer === "string"
      ? ok({ answer: record.answer })
      : fail("answer must be a string");
  },
  ANSWER_JSON_SCHEMA as unknown as Record<string, unknown>,
);

const noInput = schema<undefined>(() => ok(undefined));
const noParams = schema<undefined>(() => ok(undefined));

// The "agent" is a real subprocess emitting a controlled stdout — hostile by construction.
function fakeAgentNode(
  script: string,
  options?: {
    idleTimeoutMs?: number;
    onSchema?: (s: Record<string, unknown>) => void;
  },
) {
  return agentNode<undefined, undefined, Answer>({
    name: "fake-agent",
    input: noInput,
    params: noParams,
    output: answerSchema,
    buildCommand: (_input, _params, outputJsonSchema) => {
      options?.onSchema?.(outputJsonSchema);
      return { program: process.execPath, args: ["-e", script] };
    },
    dispatchOptions: options?.idleTimeoutMs
      ? () => ({ idleTimeoutMs: options.idleTimeoutMs })
      : undefined,
  });
}

describe("agentNode", () => {
  test("completes with validated output on well-formed agent JSON", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode(
      'process.stdout.write(JSON.stringify({ answer: "42" }))',
    );
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result).toEqual({ status: "completed", output: { answer: "42" } });
  });

  test("hands the declared output schema to the agent as JSON Schema", async () => {
    const workspace = await preparedWorkspace();
    let handed: Record<string, unknown> | undefined;
    const node = fakeAgentNode(
      'process.stdout.write(JSON.stringify({ answer: "ok" }))',
      { onSchema: (s) => (handed = s) },
    );
    await runNode(node, undefined, undefined, { workspace });
    expect(handed).toEqual(
      ANSWER_JSON_SCHEMA as unknown as Record<string, unknown>,
    );
  });

  test("fails OUTPUT_UNPARSEABLE on malformed agent output", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode('process.stdout.write("not json {")');
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("OUTPUT_UNPARSEABLE");
  });

  test("fails OUTPUT_UNPARSEABLE on empty agent output", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode("");
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("OUTPUT_UNPARSEABLE");
  });

  test("fails OUTPUT_INVALID when output parses but violates the schema", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode(
      "process.stdout.write(JSON.stringify({ answer: 42 }))",
    );
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("OUTPUT_INVALID");
  });

  test("fails COMMAND_FAILED when the agent exits non-zero", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode("process.exit(3)");
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("COMMAND_FAILED");
  });

  test("fails COMMAND_FAILED when the agent stalls past the idle timeout", async () => {
    const workspace = await preparedWorkspace();
    const node = fakeAgentNode("setTimeout(() => {}, 100000)", {
      idleTimeoutMs: 200,
    });
    const result = await runNode(node, undefined, undefined, { workspace });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.error.code).toBe("COMMAND_FAILED");
  });
});
