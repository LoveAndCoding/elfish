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

Most callers should use `prepareWorkspace()`:

```ts
import { copySource, prepareWorkspace } from "@elfish/workspace";

const workspace = await prepareWorkspace({
  rootDir: ".elfish/workspaces",
  runId: "run-123",
  source: copySource({ from: process.cwd() }),
});

console.log(workspace.sourcePath);
```

Use `gitWorktreeSource()` when the source is a local git repository and the
caller wants git-backed isolation:

```ts
import { gitWorktreeSource, prepareWorkspace } from "@elfish/workspace";

const workspace = await prepareWorkspace({
  rootDir: ".elfish/workspaces",
  id: "run-123",
  source: gitWorktreeSource({
    repositoryPath: process.cwd(),
    ref: "main",
  }),
});
```

Callers that need a workspace before source exists can split creation and
preparation:

```ts
import {
  copySource,
  createWorkspace,
  prepareWorkspaceSource,
} from "@elfish/workspace";

const workspace = await createWorkspace({
  rootDir: ".elfish/workspaces",
  data: { requestedBy: "runtime" },
});

const prepared = await prepareWorkspaceSource(
  workspace,
  copySource({ from: "/path/to/project" }),
);
```

Metadata is persisted in `metadata.json`. `writeWorkspaceMetadata()` updates only
caller-owned `data`; workspace-owned fields such as identity, paths, lifecycle,
and source metadata are updated only by workspace lifecycle helpers.

```ts
import {
  readWorkspaceMetadata,
  writeWorkspaceMetadata,
} from "@elfish/workspace";

const metadata = await readWorkspaceMetadata(workspace);

await writeWorkspaceMetadata(workspace, {
  ...metadata.data,
  note: "ready for dispatcher",
});
```

Use path helpers instead of constructing workspace paths in callers:

```ts
import {
  resolveWorkspacePath,
  resolveWorkspaceRelativePath,
} from "@elfish/workspace";

const tmp = resolveWorkspacePath(workspace, "tmp");
const report = resolveWorkspaceRelativePath(workspace, "artifacts/report.json");
```

Always call `cleanupWorkspace()` when a workspace is no longer needed. Cleanup is
idempotent by default, removes package-owned filesystem state, and removes git
worktrees through `git worktree remove --force` when source metadata requires it.

```ts
import { cleanupWorkspace } from "@elfish/workspace";

const finalMetadata = await cleanupWorkspace(workspace);
console.log(finalMetadata.status); // "cleaned"
```

Custom source strategies implement `SourceStrategy`. They receive a prepared
workspace path layout, write source into `paths.source`, and return JSON-safe
metadata. Strategy failures should throw; `prepareWorkspaceSource()` records the
failed lifecycle metadata.

## Depends On

- Bun runtime APIs.
- Filesystem and path APIs.
- Project configuration supplied by elfish callers.
- The `git` executable for `gitWorktreeSource()`.

## Notes

`@elfish/workspace` is split out of `@elfish/dispatcher` so workspace management can be reused independently.
