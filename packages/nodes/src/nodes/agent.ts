import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "@elfish/types/schema";
import type { Command, DispatchResult } from "@elfish/dispatcher";

import { commandNode } from "./command";
import type { DispatchOptions, NodeDefinition, NodeRunResult } from "../types";

/** An output schema that both validates and projects to JSON Schema (as real schemas do). */
export type AgentOutputSchema<Output> = StandardSchemaV1<unknown, Output> &
  StandardJSONSchemaV1<unknown, Output>;

export type AgentNodeSpec<Input, Params, Output> = {
  name: string;
  input: StandardSchemaV1<unknown, Input>;
  params: StandardSchemaV1<unknown, Params>;
  output: AgentOutputSchema<Output>;
  /** JSON Schema dialect handed to the agent. Defaults to draft-2020-12. */
  target?: StandardJSONSchemaV1.Target;
  /** Builds the agent invocation, given the output contract as JSON Schema. */
  buildCommand(
    input: Input,
    params: Params,
    outputJsonSchema: Record<string, unknown>,
  ): Command;
  dispatchOptions?(input: Input, params: Params): DispatchOptions;
  /** Extracts the structured payload from the agent result. Defaults to JSON.parse(stdout). */
  parseOutput?(result: DispatchResult): unknown;
};

/**
 * A node that runs an agent and validates its structured output. Built on commandNode, so a
 * non-zero exit or a stall (idle timeout) surfaces as a failure before parsing; malformed or
 * schema-violating output is rejected at the boundary.
 */
export function agentNode<Input, Params, Output>(
  spec: AgentNodeSpec<Input, Params, Output>,
): NodeDefinition<Input, Params, Output> {
  const target = spec.target ?? "draft-2020-12";
  const outputJsonSchema = spec.output["~standard"].jsonSchema.output({
    target,
  });
  const parseOutput =
    spec.parseOutput ?? ((result: DispatchResult) => JSON.parse(result.stdout));

  return commandNode<Input, Params, Output>({
    name: spec.name,
    input: spec.input,
    params: spec.params,
    output: spec.output,
    buildCommand: (input, params) =>
      spec.buildCommand(input, params, outputJsonSchema),
    dispatchOptions: spec.dispatchOptions,
    mapResult(result): NodeRunResult<Output> {
      let parsed: unknown;
      try {
        parsed = parseOutput(result);
      } catch (error) {
        return {
          status: "failed",
          error: {
            code: "OUTPUT_UNPARSEABLE",
            message: `agent ${spec.name} produced unparseable output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        };
      }
      // defineNode validates this against the output schema (→ OUTPUT_INVALID if it violates it).
      return { status: "completed", output: parsed as Output };
    },
  });
}
