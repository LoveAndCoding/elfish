import { describe, expect, test } from "bun:test";

import { awaitNode, humanApproval } from "./await";
import { runNode, resumeNode } from "../testing/harness";
import { fail, ok, schema } from "../testing/schema";

const stringSchema = schema<string>((value) =>
  typeof value === "string" ? ok(value) : fail("expected a string"),
);

const noParams = schema<undefined>(() => ok(undefined));

function approvalNode() {
  return humanApproval<{ change: string }, undefined, string>({
    name: "review",
    input: schema((value) => ok(value as { change: string })),
    params: noParams,
    output: stringSchema,
    buildPrompt: (input) => ({ question: `approve ${input.change}?` }),
    onDecision: (decision) => ({
      status: "completed",
      output: decision.approved ? "approved" : "rejected",
    }),
  });
}

describe("awaitNode", () => {
  test("suspends immediately with a serializable state and waitingFor", async () => {
    const node = awaitNode<string, undefined, { value: string }, string>({
      name: "wait-input",
      waitingFor: "user-input",
      input: stringSchema,
      params: noParams,
      signal: schema((value) => ok(value as { value: string })),
      output: stringSchema,
      buildState: (input) => ({ prompt: input }),
      onSignal: (signal) => ({ status: "completed", output: signal.value }),
    });

    const result = await runNode(node, "name?", undefined);
    expect(result.status).toBe("suspended");
    if (result.status !== "suspended") throw new Error("unreachable");
    expect(result.waitingFor).toBe("user-input");
    expect(result.state).toEqual({ prompt: "name?" });
    // State must survive a JSON round-trip.
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  test("resumes to completed when the signal is valid", async () => {
    const node = awaitNode<string, undefined, { value: string }, string>({
      name: "wait-input",
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
      onSignal: (signal) => ({ status: "completed", output: signal.value }),
    });

    const resumed = await resumeNode(
      node,
      { prompt: "name?" },
      { value: "Ada" },
      undefined,
    );
    expect(resumed).toEqual({ status: "completed", output: "Ada" });
  });

  test("resumes to failed SIGNAL_INVALID when the signal is malformed", async () => {
    const node = awaitNode<string, undefined, { value: string }, string>({
      name: "wait-input",
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
      onSignal: (signal) => ({ status: "completed", output: signal.value }),
    });

    const resumed = await resumeNode(
      node,
      { prompt: "x" },
      { value: 7 },
      undefined,
    );
    expect(resumed.status).toBe("failed");
    if (resumed.status !== "failed") throw new Error("unreachable");
    expect(resumed.error.code).toBe("SIGNAL_INVALID");
  });
});

describe("humanApproval preset", () => {
  test("suspends waiting for approval", async () => {
    const result = await runNode(
      approvalNode(),
      { change: "the diff" },
      undefined,
    );
    expect(result.status).toBe("suspended");
    if (result.status !== "suspended") throw new Error("unreachable");
    expect(result.waitingFor).toBe("approval");
    expect(result.state).toEqual({ question: "approve the diff?" });
  });

  test("resumes with a valid decision", async () => {
    const resumed = await resumeNode(
      approvalNode(),
      { question: "approve the diff?" },
      { approved: true },
      undefined,
    );
    expect(resumed).toEqual({ status: "completed", output: "approved" });
  });

  test("rejects a malformed decision with SIGNAL_INVALID", async () => {
    const resumed = await resumeNode(
      approvalNode(),
      { question: "approve the diff?" },
      { approved: "yes" },
      undefined,
    );
    expect(resumed.status).toBe("failed");
    if (resumed.status !== "failed") throw new Error("unreachable");
    expect(resumed.error.code).toBe("SIGNAL_INVALID");
  });
});
