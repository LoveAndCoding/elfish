# @elfish/gates

## Role

`@elfish/gates` defines gate contracts and reusable gate packs for deciding whether a workflow phase can proceed.

Gates evaluate read-only workflow context and return structured pass/fail results.

## Owns

- Gate result contracts.
- Gate execution input contracts.
- Reusable gate packs.
- JavaScript and TypeScript gate pack exports, such as `@elfish/gates/js`.

## Does Not Own

- Workflow sequencing.
- Run state mutation.
- Agent dispatch.
- Workspace creation.
- Phase execution.
- Final result determination.

## Public API

- Core gate types for defining phase readiness checks.
- Structured pass/fail result shapes.
- Reusable gate pack entrypoints.
- `@elfish/gates/js` for JavaScript and TypeScript workflow checks.

## Depends On

- TypeScript.
- Read-only workflow context supplied by callers.

## Notes

Gates should be deterministic, side-effect-light checks. They report whether a phase may continue and why; callers decide what to do with that result.
