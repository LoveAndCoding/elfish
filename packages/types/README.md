# @elfish/types

## Role

`@elfish/types` defines shared TypeScript primitives used across elfish packages.

This package is for stable, cross-package type contracts that do not belong to one implementation package.

## Owns

- Shared type primitives.
- Public cross-package contracts.
- Small utility types that keep package APIs consistent.

## Does Not Own

- Runtime behavior.
- Package-specific implementation types.
- Validation schemas.
- Workflow, node, agent, hook, or gate authoring helpers.

## Public API

Types exported from `src/index.ts` are the public shared type surface for other `@elfish/*` packages.

## Depends On

- TypeScript.

## Notes

Keep this package focused on types that are truly shared. If a type only describes one package's internals, define it in that package instead.
