import type { StandardSchemaV1 } from "@elfish/types/schema";
import type { JsonValue } from "@elfish/types/json";
import type {
  Command,
  DispatchRequest,
  DispatchResult,
} from "@elfish/dispatcher";

export type NodeIssue = {
  message: string;
  path?: ReadonlyArray<PropertyKey>;
};

export type NodeErrorSummary = {
  code: string;
  message: string;
  issues?: ReadonlyArray<NodeIssue>;
};

export type NodeRunResult<Output> =
  | { status: "completed"; output: Output }
  | { status: "suspended"; waitingFor: string; state: JsonValue }
  | { status: "failed"; error: NodeErrorSummary };

/** Capability a node may declare it needs. The runtime injects matching members on `ctx`. */
export type CapabilityName = "dispatch";

/** Dispatch knobs a node controls; the workspace and cancellation signal come from the runtime. */
export type DispatchOptions = Omit<
  DispatchRequest,
  "workspace" | "command" | "signal"
>;

export type DispatchCapability = (
  command: Command,
  options?: DispatchOptions,
) => Promise<DispatchResult>;

export type NodeContext = {
  /** Cancellation. The runtime forwards this to dispatched commands. */
  signal: AbortSignal;
  /** Present only when the node declares the `"dispatch"` capability. */
  dispatch?: DispatchCapability;
};

export type NodeDefinition<Input, Params, Output> = {
  name: string;
  capabilities: readonly CapabilityName[];
  input: StandardSchemaV1<unknown, Input>;
  params: StandardSchemaV1<unknown, Params>;
  /** Must be validatable: node output is an external boundary and is always re-checked. */
  output: StandardSchemaV1<unknown, Output>;
  run(
    input: Input,
    params: Params,
    ctx: NodeContext,
  ): Promise<NodeRunResult<Output>>;
  resume?(
    state: JsonValue,
    signal: unknown,
    params: Params,
    ctx: NodeContext,
  ): Promise<NodeRunResult<Output>>;
};
