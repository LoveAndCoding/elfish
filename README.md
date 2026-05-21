# elfish

elfish is an agentic coding workflow harness and orchestrator.

Projects define their workflows. elfish provides the authoring syntax, runtime, and runner surfaces that load those workflows and coordinate agent work.

## Apps

- `apps/cli`: terminal entrypoint for the `elfish` command.
- `apps/web`: web interface for inspecting and controlling runs.

## Packages

- `@elfish/config`: project config authoring API.
- `@elfish/workflows`: reusable workflow definitions and `defineWorkflow`.
- `@elfish/nodes`: composable workflow step definitions.
- `@elfish/gates`: gate contracts and reusable gate packs.
- `@elfish/hooks`: lifecycle extension points.
- `@elfish/runtime`: config loading, run coordination, state, retries, and result determination.
- `@elfish/workspace`: workspace creation, metadata, and cleanup.
- `@elfish/dispatcher`: dispatches tasks to agents in prepared workspaces.
- `@elfish/agents`: agent adapter contracts and integrations.

## Development

```bash
bun install
```
