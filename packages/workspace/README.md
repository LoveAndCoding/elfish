# @elfish/workspace

## Role

`@elfish/workspace` manages isolated workspaces for elfish runs.

It provides the filesystem and lifecycle boundary where agents and workflows can operate without owning how agents are dispatched or how run outcomes are decided.

## Owns

- Creating run workspaces.
- Checking out or copying source into a workspace.
- Tracking workspace lifecycle metadata.
- Cleaning up workspaces when they are no longer needed.
- Exposing workspace paths and metadata to other elfish packages.

## Does Not Own

- Dispatching agent commands.
- Evaluating gates.
- Executing workflows.
- Selecting workflows.
- Deciding run results.
- Interpreting agent output.

## Public API

- Create a workspace for a run.
- Prepare source using a checkout or copy strategy.
- Read and write workspace metadata.
- Resolve workspace paths.
- Clean up a workspace.

## Depends On

- Bun runtime APIs.
- Filesystem and path APIs.
- Project configuration supplied by elfish callers.

## Notes

`@elfish/workspace` is split out of `@elfish/dispatcher` so workspace management can be reused independently.
