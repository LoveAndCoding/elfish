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

- `defineNode`: define a typed workflow step with its inputs, outputs, capability needs, and execution contract.

## Depends On

- TypeScript.

## Notes

Nodes should stay declarative and composable. They describe what a step needs and produces; other packages decide where and how that work runs.
