# apps/cli

## Role

`apps/cli` provides the `elfish` command for running elfish workflows from a terminal or automation environment.

## Owns

- Parsing CLI input for the `elfish` command.
- Passing the working directory or explicit config path to `@elfish/runtime`.
- Selecting the requested workflow.
- Starting workflow runs through `@elfish/runtime`.
- Printing concise, agent-friendly output.

## Does Not Own

- Workflow semantics.
- Workspace lifecycle.
- Dispatch internals.
- Web UI behavior.
- Package authoring APIs.

## Public Surface

- `elfish` command.
- CLI flags, arguments, exit codes, and output format.
- Flags and arguments for selecting the project directory or config path.

## Depends On

- Bun.
- TypeScript.
- `@elfish/runtime`.

## Notes

Keep this app thin. The CLI should translate user intent into runtime calls without embedding workflow rules, config loading, or package-level behavior.
