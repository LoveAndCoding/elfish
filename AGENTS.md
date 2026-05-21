# elfish Agent Instructions

elfish (always lowercase) is an agentic coding workflow harness and orchestrator

Projects define their workflows, elfish provides the syntax and the runner

## Architecture

Monorepo with `apps/` for product entrypoints and `packages/` for composable `@elfish/*` packages. Each README defines package boundaries. Platform is `bun` and Typescript

## Do

- KISS
- write clear and concise documentation for external APIs
- use modern code and libraries over custom code for complex logic and systems
- create `@elfish/*` packages for composable pieces of the system
- default to extensibility over rigidity

## Don't

- hard-code workflows; projects own their own workflows, elfish provides reasonable defaults and structure
- document details in internal code that can be inferred form the code itself
- use libraries for simple logic or tasks
