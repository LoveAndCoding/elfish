# @elfish/hooks

## Role

`@elfish/hooks` provides lifecycle and event extension points for elfish workflows.

Hooks observe or augment workflow events. They are optional extensions and should not be required for core workflow correctness.

## Owns

- Hook registration shape.
- Hook execution contracts.
- Lifecycle event handlers.
- Event augmentation patterns.
- Built-in hooks such as `follow-up`.

## Does Not Own

- Workflow state decisions.
- Agent execution.
- Workspace creation.
- Config syntax.
- Gate evaluation.
- Workflow definitions.

## Public API

- Hook contracts.
- Built-in hook entrypoints such as `@elfish/hooks/follow-up`.

## Depends On

- Workflow lifecycle event data.
- Shared TypeScript types.
- Bun runtime conventions.

## Notes

Hooks should be small, composable, and safe to omit. A workflow must remain correct if no hooks are configured.
