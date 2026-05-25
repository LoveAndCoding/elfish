# @elfish/nodes

## Role

`@elfish/nodes` defines composable workflow steps.

Nodes describe units of work: what inputs they accept, what outputs they produce, and what capabilities they need from the runtime.

## Owns

- Node definition types.
- `defineNode`.
- Input and output contracts for workflow steps.
- Capability requirements declared by a node.
- Reusable step metadata consumed by workflow and runtime packages.

## Does Not Own

- Creating workspaces.
- Talking directly to vendors or agent providers.
- Persisting run state.
- Dispatching commands.
- Deciding whole-workflow success.
- Encoding project-specific workflow policy.

## Public API

- `defineNode`: define a typed workflow step with its inputs, outputs, capability needs, and execution contract. Validates input, params, and output at the boundary, turning bad data into a `failed` result rather than a thrown exception.
- `commandNode`: run a single command through the injected `dispatch` capability and map the result to output.
- `agentNode`: run an agent, hand it the output schema as JSON Schema, and validate its structured output (built on `commandNode`).
- `awaitNode`: suspend immediately and resume when an external signal arrives; `humanApproval` is a preset for human approval.

A node's `run`/`resume` return a `NodeRunResult`: `completed`, `suspended` (with JSON-serializable state the runtime persists and later resumes), or `failed`.

## Depends On

- `@elfish/types` (Standard Schema and shared JSON primitives).
- `@elfish/dispatcher` (command/result types for the `dispatch` capability).

## Notes

Nodes stay declarative and composable. They describe what a step needs and produces; other packages decide where and how that work runs. A node never owns the dispatcher or run-state persistence: it declares the `dispatch` capability and the runtime injects it on `ctx`, and it returns serializable results for the runtime to persist.
