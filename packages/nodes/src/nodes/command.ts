import type { StandardSchemaV1 } from "@elfish/types/schema";
import { DispatcherError } from "@elfish/dispatcher";
import type { Command, DispatchResult } from "@elfish/dispatcher";

import { defineNode } from "../define";
import type { DispatchOptions, NodeDefinition, NodeRunResult } from "../types";

export type CommandNodeSpec<Input, Params, Output> = {
  name: string;
  input: StandardSchemaV1<unknown, Input>;
  params: StandardSchemaV1<unknown, Params>;
  output: StandardSchemaV1<unknown, Output>;
  buildCommand(input: Input, params: Params): Command;
  /** Optional per-run dispatch knobs (timeouts, output limits). */
  dispatchOptions?(input: Input, params: Params): DispatchOptions;
  /** Maps a successful command result into the node output. Called only on a clean exit. */
  mapResult(
    result: DispatchResult,
    input: Input,
    params: Params,
  ): NodeRunResult<Output> | Promise<NodeRunResult<Output>>;
};

/** A node that runs a single command through the dispatch capability. */
export function commandNode<Input, Params, Output>(
  spec: CommandNodeSpec<Input, Params, Output>,
): NodeDefinition<Input, Params, Output> {
  return defineNode<Input, Params, Output>({
    name: spec.name,
    capabilities: ["dispatch"],
    input: spec.input,
    params: spec.params,
    output: spec.output,
    async run(input, params, ctx) {
      if (!ctx.dispatch) {
        return {
          status: "failed",
          error: {
            code: "MISSING_CAPABILITY",
            message: `node ${spec.name} requires the dispatch capability`,
          },
        };
      }

      let result: DispatchResult;
      try {
        result = await ctx.dispatch(
          spec.buildCommand(input, params),
          spec.dispatchOptions?.(input, params),
        );
      } catch (error) {
        return {
          status: "failed",
          error: {
            code:
              error instanceof DispatcherError ? error.code : "DISPATCH_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }

      if (result.terminationReason !== "exited" || result.exitCode !== 0) {
        const exit =
          result.exitCode === null ? "" : ` (exit ${result.exitCode})`;
        return {
          status: "failed",
          error: {
            code: "COMMAND_FAILED",
            message: `command ${result.command.program} ${result.terminationReason}${exit}`,
          },
        };
      }

      return spec.mapResult(result, input, params);
    },
  });
}
