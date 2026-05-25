import { dispatch } from "@elfish/dispatcher";
import type { WorkspaceHandle } from "@elfish/workspace";
import type { JsonValue } from "@elfish/types/json";

import type {
  CapabilityName,
  DispatchCapability,
  NodeContext,
  NodeDefinition,
  NodeRunResult,
} from "../types";

// A minimal stand-in for the future @elfish/runtime: it gates capability injection on a
// node's declared needs and dispatches through the real dispatcher against a real workspace.
// It owns nothing a node owns; it exists so tests can drive nodes the way the runtime will.

export type HarnessOptions = {
  /** Providing a workspace makes the `"dispatch"` capability available. */
  workspace?: WorkspaceHandle;
  signal?: AbortSignal;
};

function availableCapabilities(options: HarnessOptions): Set<CapabilityName> {
  const available = new Set<CapabilityName>();
  if (options.workspace) available.add("dispatch");
  return available;
}

function buildContext(
  declared: readonly CapabilityName[],
  options: HarnessOptions,
): NodeContext {
  const signal = options.signal ?? new AbortController().signal;
  const ctx: NodeContext = { signal };
  // Gated injection: a capability is wired onto ctx only if the node declared it.
  if (declared.includes("dispatch") && options.workspace) {
    const workspace = options.workspace;
    const dispatchCapability: DispatchCapability = (command, dispatchOptions) =>
      dispatch({ workspace, command, signal, ...dispatchOptions });
    ctx.dispatch = dispatchCapability;
  }
  return ctx;
}

function missingCapability(error: string): NodeRunResult<never> {
  return {
    status: "failed",
    error: { code: "MISSING_CAPABILITY", message: error },
  };
}

function caught(error: unknown): NodeRunResult<never> {
  return {
    status: "failed",
    error: {
      code: "NODE_THREW",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

export async function runNode<Input, Params, Output>(
  node: NodeDefinition<Input, Params, Output>,
  input: Input,
  params: Params,
  options: HarnessOptions = {},
): Promise<NodeRunResult<Output>> {
  const available = availableCapabilities(options);
  const missing = node.capabilities.filter((name) => !available.has(name));
  if (missing.length > 0) {
    return missingCapability(
      `runtime cannot satisfy capabilities: ${missing.join(", ")}`,
    );
  }
  try {
    return await node.run(
      input,
      params,
      buildContext(node.capabilities, options),
    );
  } catch (error) {
    return caught(error);
  }
}

export async function resumeNode<Input, Params, Output>(
  node: NodeDefinition<Input, Params, Output>,
  state: JsonValue,
  signal: unknown,
  params: Params,
  options: HarnessOptions = {},
): Promise<NodeRunResult<Output>> {
  if (!node.resume) {
    return {
      status: "failed",
      error: {
        code: "NOT_RESUMABLE",
        message: `node ${node.name} cannot resume`,
      },
    };
  }
  try {
    return await node.resume(
      state,
      signal,
      params,
      buildContext(node.capabilities, options),
    );
  } catch (error) {
    return caught(error);
  }
}

export type PersistedSuspension = {
  node: string;
  waitingFor: string;
  state: JsonValue;
};

export async function persistSuspension(
  path: string,
  nodeName: string,
  result: NodeRunResult<unknown>,
): Promise<void> {
  if (result.status !== "suspended") {
    throw new Error(`cannot persist a ${result.status} result`);
  }
  const record: PersistedSuspension = {
    node: nodeName,
    waitingFor: result.waitingFor,
    state: result.state,
  };
  await Bun.write(path, JSON.stringify(record));
}

export async function loadSuspension(
  path: string,
): Promise<PersistedSuspension> {
  return JSON.parse(await Bun.file(path).text()) as PersistedSuspension;
}
