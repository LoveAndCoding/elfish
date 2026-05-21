# @elfish/workflows

## Role

`@elfish/workflows` provides reusable workflow definitions and workflow authoring helpers.

Projects can use, adapt, or compose these workflows. The package describes how workflow nodes, gates, hooks, and agent requirements fit together.

## Owns

- Standard workflow definitions such as `standard`, `quick-fix`, `eipc`, and `doc-update`.
- `defineWorkflow`.
- Workflow-level structure, sequencing, and requirements.
- Composition of nodes, gates, hooks, and agent requirements.
- Reasonable default workflows for common agentic coding tasks.

## Does Not Own

- Creating or managing workspaces.
- Dispatching commands directly to agents.
- Runtime execution state.
- Result determination.
- Low-level agent integrations.
- Project-specific workflow policy.

## Public API

- `defineWorkflow`.
- Reusable workflow definitions exported by the package.

## Depends On

- TypeScript.
- `@elfish/nodes`.
- `@elfish/gates`.
- `@elfish/hooks`.
- `@elfish/agents` capability contracts.

## Notes

Projects own their workflows. This package provides reusable definitions and authoring primitives, not fixed workflow policy.
