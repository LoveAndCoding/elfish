# @elfish/runtime

## Role

`@elfish/runtime` coordinates workflow execution for elfish.

It is the shared programmatic surface used by `apps/cli` and `apps/web` to start, resume, observe, and determine the outcome of workflow runs.

## Owns

- Project config discovery, loading, and resolution for run startup.
- Run state.
- Workflow execution.
- Persistence boundary.
- Result determination.
- Retry coordination.
- Coordination between config, workflows, gates, hooks, workspace, and dispatcher.

## Does Not Own

- Project authoring definitions.
- Concrete workspace creation details.
- Direct agent vendor integrations.
- UI behavior.
- CLI formatting.

## Public API

- Create and manage workflow runs.
- Load project config for a run.
- Execute workflows from resolved config.
- Persist and restore run state.
- Evaluate run results.
- Coordinate retries.
- Expose runtime events and status for consumers.

## Depends On

- `@elfish/config`.
- `@elfish/workflows`.
- `@elfish/gates`.
- `@elfish/hooks`.
- `@elfish/workspace`.
- `@elfish/dispatcher`.

## Notes

The runtime should stay focused on execution coordination. Config validation should use `@elfish/config`; command execution should flow through `@elfish/dispatcher`.
