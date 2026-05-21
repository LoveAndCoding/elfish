# @elfish/dispatcher

## Role

`@elfish/dispatcher` invokes agent adapters for commands or tasks within an already prepared workspace.

It is the boundary between workflow execution and agent adapter integration: callers decide what should happen, and the dispatcher performs the handoff to the selected adapter using the provided workspace context.

## Owns

- Dispatching commands or tasks through agent adapters.
- Passing workspace handles and execution context to agents.
- Normalizing dispatcher-facing inputs and outputs.
- Reporting dispatch-level failures, such as an unavailable agent or invalid dispatch request.

## Does not own

- Creating workspaces.
- Cleaning up workspaces.
- Determining workflow results.
- Evaluating gates.
- Selecting or defining workflow logic.
- Interpreting whether an agent result satisfies a workflow step.

## Public API

- Dispatch request types.
- Dispatch result and error types.
- Functions that invoke agent adapters with prepared workspace context.

## Depends On

- `@elfish/agents` for adapter contracts and normalized adapter results.
- Workspace handles from `@elfish/workspace`.
- Workflow callers that decide what task should be dispatched and how the result should be interpreted.

## Notes

`@elfish/dispatcher` should remain workflow-agnostic. Projects own their workflows; elfish provides the runner structure and dispatch boundary.
