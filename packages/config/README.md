# @elfish/config

## Role

`@elfish/config` is the primary authoring API for `.elfish/config.ts`.

Project authors use this package to declare hooks, gates, and workflows by module reference. The package defines the config contract, keeps authoring types stable, and validates config shape without executing workflows.

## Owns

- `defineConfig`.
- Config schema and TypeScript types.
- Config validation helpers.
- Module reference types and helpers.
- Normalization of author-authored config shape.
- Clear validation errors for invalid config structure.

## Does Not Own

- Executing workflows.
- Resolving or running agent commands.
- Creating or managing workspaces.
- Dispatching work to agents.
- Implementing built-in workflows, gates, or hooks.
- Deciding workflow results.

## Public API

- `defineConfig(config)`: typed helper for authoring `.elfish/config.ts`.
- Config types for hooks, gates, workflows, and full project config.
- Module reference helpers for hook, gate, and workflow modules.

Validation, normalization, and schema helpers should stay internal unless a concrete external consumer needs them.

## Depends On

- TypeScript.
- Minimal schema or validation utilities, if needed.
- Shared elfish type primitives, if needed.

## Notes

Module references are declarations, not execution instructions. `@elfish/runtime` decides how and when project config is loaded for a run and how references are resolved.
