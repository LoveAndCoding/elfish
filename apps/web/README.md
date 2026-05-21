# apps/web

## Role

`apps/web` provides the web interface for inspecting and controlling elfish runs.

## Owns

- Run dashboards and detail views.
- UI controls for starting, stopping, and reviewing runs.
- Presentation of workflow state, logs, results, and diagnostics.
- Browser-facing routes, components, and client state.

## Does Not Own

- Workflow orchestration.
- Agent dispatching.
- Runtime state machines.
- Project workflow definitions.
- Persistence or execution semantics beyond what runtime APIs expose.

## Public Surface

- Web routes for run inspection and control.
- UI components for displaying elfish runtime data.
- Client-side adapters for runtime-backed services.

## Depends On

- Bun.
- TypeScript.
- `@elfish/runtime`.
- Shared `@elfish/*` packages where appropriate.

## Notes

`apps/web` should consume runtime APIs instead of duplicating orchestration logic. It owns UI and client adapters; `@elfish/runtime` or a future service layer owns config-backed run mutations.
