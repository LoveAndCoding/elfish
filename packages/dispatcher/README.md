# @elfish/dispatcher

## Role

`@elfish/dispatcher` invokes native commands within an already prepared workspace.

It is the boundary between workflow and execution: callers decide what should happen, and the dispatcher performs the native process handoff using the provided workspace context.

## Owns

- Dispatching native commands.
- Passing prepared workspace context to commands.
- Normalizing dispatcher-facing inputs and outputs.
- Controlling idle timeouts, wall-clock timeout fallback, caller cancellation, output limits, and exit codes.
- Reporting dispatch-level failures, such as an unavailable command or invalid dispatch request.

## Does not own

- Creating workspaces.
- Cleaning up workspaces.
- Determining workflow results.
- Evaluating gates.
- Selecting or defining workflow logic.
- Interpreting whether command output satisfies a workflow step.

## Public API

- Dispatch request types.
- Dispatch result and error types.
- `dispatch(request)`, which invokes a provided command with prepared workspace context.

## Command behavior

- Commands run with `cwd` set to `workspace.sourcePath` unless the caller provides a workspace-relative `cwd`.
- `program` and `args` are passed directly as argv. Dispatcher does not invoke a shell, split strings, quote arguments, chunk oversized input, or infer stdin/file transports.
- `env` is the complete child-process environment. Dispatcher does not inherit the CLI process environment, which avoids leaking secrets by default. Undefined env values are omitted.
- Nonzero exit codes are returned as dispatch results, not interpreted as workflow failure.
- Non-positive, infinite, and `NaN` timeout or output-limit values are ignored. Output limits fall back to dispatcher defaults.
- Idle timeout measures time since the last stdout or stderr output. Wall-clock timeout is a longer fallback for commands that keep producing output but never finish.
- When dispatcher stops a command, it sends `SIGTERM` first to allow cleanup, then sends `SIGKILL` after a grace period if the process does not exit.

## Depends On

- Workspace handles from `@elfish/workspace`.
- Workflow callers that decide what task should be dispatched and how the result should be interpreted.

## Notes

`@elfish/dispatcher` should remain workflow-agnostic. Projects own their workflows; elfish provides the runner structure and dispatch boundary.
