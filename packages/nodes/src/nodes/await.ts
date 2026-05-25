import type { StandardSchemaV1 } from "@elfish/types/schema";
import type { JsonValue } from "@elfish/types/json";

import { defineNode } from "../define";
import type { NodeDefinition, NodeRunResult } from "../types";

export type AwaitNodeSpec<Input, Params, Signal, Output> = {
  name: string;
  /** Identifies what the suspended node is waiting on (e.g. "approval"). */
  waitingFor: string;
  input: StandardSchemaV1<unknown, Input>;
  params: StandardSchemaV1<unknown, Params>;
  /** Validates the external signal delivered on resume. */
  signal: StandardSchemaV1<unknown, Signal>;
  output: StandardSchemaV1<unknown, Output>;
  /** Serializable payload describing the request being awaited. */
  buildState(input: Input, params: Params): JsonValue;
  /** Maps a validated signal (plus the persisted state) into a node result. */
  onSignal(
    signal: Signal,
    state: JsonValue,
    params: Params,
  ): NodeRunResult<Output> | Promise<NodeRunResult<Output>>;
};

/**
 * A node that suspends immediately and resumes when an external signal arrives. The same
 * machinery serves human approval, timers, or webhooks via different specs.
 */
export function awaitNode<Input, Params, Signal, Output>(
  spec: AwaitNodeSpec<Input, Params, Signal, Output>,
): NodeDefinition<Input, Params, Output> {
  return defineNode<Input, Params, Output>({
    name: spec.name,
    capabilities: [],
    input: spec.input,
    params: spec.params,
    output: spec.output,
    async run(input, params) {
      return {
        status: "suspended",
        waitingFor: spec.waitingFor,
        state: spec.buildState(input, params),
      };
    },
    async resume(state, signal, params) {
      const checked = await spec.signal["~standard"].validate(signal);
      if (checked.issues) {
        return {
          status: "failed",
          error: {
            code: "SIGNAL_INVALID",
            message: `signal for ${spec.name} failed validation`,
            issues: checked.issues.map((issue) => ({ message: issue.message })),
          },
        };
      }
      return spec.onSignal(checked.value, state, params);
    },
  });
}

export type ApprovalDecision = { approved: boolean; note?: string };

export type HumanApprovalSpec<Input, Params, Output> = {
  name: string;
  input: StandardSchemaV1<unknown, Input>;
  params: StandardSchemaV1<unknown, Params>;
  output: StandardSchemaV1<unknown, Output>;
  /** Serializable description of what a human is being asked to approve. */
  buildPrompt(input: Input, params: Params): JsonValue;
  onDecision(
    decision: ApprovalDecision,
    state: JsonValue,
    params: Params,
  ): NodeRunResult<Output> | Promise<NodeRunResult<Output>>;
};

export function humanApproval<Input, Params, Output>(
  spec: HumanApprovalSpec<Input, Params, Output>,
): NodeDefinition<Input, Params, Output> {
  return awaitNode<Input, Params, ApprovalDecision, Output>({
    name: spec.name,
    waitingFor: "approval",
    input: spec.input,
    params: spec.params,
    signal: approvalSignalSchema,
    output: spec.output,
    buildState: spec.buildPrompt,
    onSignal: spec.onDecision,
  });
}

const approvalSignalSchema: StandardSchemaV1<unknown, ApprovalDecision> = {
  "~standard": {
    version: 1,
    vendor: "@elfish/nodes",
    validate(value) {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "approval must be an object" }] };
      }
      const record = value as Record<string, unknown>;
      if (typeof record.approved !== "boolean") {
        return { issues: [{ message: "approved must be a boolean" }] };
      }
      if (record.note !== undefined && typeof record.note !== "string") {
        return { issues: [{ message: "note must be a string" }] };
      }
      return {
        value: {
          approved: record.approved,
          note: record.note as string | undefined,
        },
      };
    },
  },
};
