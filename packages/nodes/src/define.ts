import type { StandardSchemaV1 } from "@elfish/types/schema";

import type { NodeDefinition, NodeIssue, NodeRunResult } from "./types";

function toNodeIssue(issue: StandardSchemaV1.Issue): NodeIssue {
  return {
    message: issue.message,
    path: issue.path?.map((segment) =>
      typeof segment === "object" ? segment.key : segment,
    ),
  };
}

function invalid(
  code: string,
  message: string,
  issues: ReadonlyArray<StandardSchemaV1.Issue>,
): NodeRunResult<never> {
  return {
    status: "failed",
    error: { code, message, issues: issues.map(toNodeIssue) },
  };
}

async function validateOutput<Output>(
  output: StandardSchemaV1<unknown, Output>,
  result: NodeRunResult<Output>,
): Promise<NodeRunResult<Output>> {
  if (result.status !== "completed") return result;
  const checked = await output["~standard"].validate(result.output);
  if (checked.issues) {
    return invalid(
      "OUTPUT_INVALID",
      "Node output failed validation",
      checked.issues,
    );
  }
  return { status: "completed", output: checked.value };
}

/**
 * Wraps a node so input, params, and output are validated at the boundary. Validation
 * failures become `failed` results rather than thrown exceptions, so a node never leaks
 * an exception past its contract.
 */
export function defineNode<Input, Params, Output>(
  spec: NodeDefinition<Input, Params, Output>,
): NodeDefinition<Input, Params, Output> {
  const { resume } = spec;

  return {
    ...spec,
    async run(input, params, ctx) {
      const checkedInput = await spec.input["~standard"].validate(input);
      if (checkedInput.issues) {
        return invalid(
          "INPUT_INVALID",
          "Node input failed validation",
          checkedInput.issues,
        );
      }
      const checkedParams = await spec.params["~standard"].validate(params);
      if (checkedParams.issues) {
        return invalid(
          "PARAMS_INVALID",
          "Node params failed validation",
          checkedParams.issues,
        );
      }
      const result = await spec.run(
        checkedInput.value,
        checkedParams.value,
        ctx,
      );
      return validateOutput(spec.output, result);
    },
    resume: resume
      ? async (state, signal, params, ctx) => {
          const checkedParams = await spec.params["~standard"].validate(params);
          if (checkedParams.issues) {
            return invalid(
              "PARAMS_INVALID",
              "Node params failed validation",
              checkedParams.issues,
            );
          }
          const result = await resume(state, signal, checkedParams.value, ctx);
          return validateOutput(spec.output, result);
        }
      : undefined,
  };
}
