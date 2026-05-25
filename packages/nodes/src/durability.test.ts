import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { awaitNode } from "./nodes/await";
import {
  loadSuspension,
  persistSuspension,
  resumeNode,
  runNode,
} from "./testing/harness";
import { fail, ok, schema } from "./testing/schema";

const tempRoots: string[] = [];

async function tempFile(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "elfish-nodes-"));
  tempRoots.push(dir);
  return join(dir, name);
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

const noParams = schema<undefined>(() => ok(undefined));

function gatedNode() {
  return awaitNode<string, undefined, { value: string }, string>({
    name: "collect",
    waitingFor: "user-input",
    input: stringSchema,
    params: noParams,
    signal: schema((value) =>
      typeof (value as { value?: unknown }).value === "string"
        ? ok(value as { value: string })
        : fail("value must be a string"),
    ),
    output: stringSchema,
    buildState: (input) => ({ prompt: input }),
    onSignal: (signal, state) => ({
      status: "completed",
      output: `${(state as { prompt: string }).prompt} -> ${signal.value}`,
    }),
  });
}

describe("durability seam", () => {
  test("suspends, persists to disk, then resumes from the reloaded state", async () => {
    const node = gatedNode();

    // 1. Run to suspension.
    const suspended = await runNode(node, "your name?", undefined);
    expect(suspended.status).toBe("suspended");

    // 2. Persist the suspension to a real file, then drop the in-memory result.
    const path = await tempFile("suspension.json");
    await persistSuspension(path, node.name, suspended);

    // 3. Rebuild from disk only — nothing carries over except the persisted state.
    const reloaded = await loadSuspension(path);
    expect(reloaded.node).toBe("collect");
    expect(reloaded.waitingFor).toBe("user-input");

    // 4. Resume with the delivered signal and the reloaded state.
    const resumed = await resumeNode(
      node,
      reloaded.state,
      { value: "Ada" },
      undefined,
    );
    expect(resumed).toEqual({
      status: "completed",
      output: "your name? -> Ada",
    });
  });
});
