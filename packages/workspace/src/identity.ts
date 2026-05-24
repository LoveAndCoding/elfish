import { join } from "node:path";

import { WorkspaceError } from "./errors";
import type {
  WorkspaceHandle,
  WorkspaceMetadata,
  WorkspacePaths,
} from "./types";

export function validateWorkspaceId(id: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new WorkspaceError(
      "INVALID_WORKSPACE_PATH",
      `Workspace id must contain only ASCII letters, numbers, ".", "_", and "-": ${id}`,
    );
  }
}

export function workspacePaths(rootDir: string, id: string): WorkspacePaths {
  const root = join(rootDir, "runs", id);
  return {
    root,
    source: join(root, "source"),
    tmp: join(root, "tmp"),
    artifacts: join(root, "artifacts"),
    metadata: join(root, "metadata.json"),
  };
}

export function handleFromMetadata(
  metadata: WorkspaceMetadata,
): WorkspaceHandle {
  return {
    id: metadata.id,
    ...(metadata.runId === undefined ? {} : { runId: metadata.runId }),
    rootPath: metadata.paths.root,
    sourcePath: metadata.paths.source,
    tmpPath: metadata.paths.tmp,
    artifactsPath: metadata.paths.artifacts,
    metadataPath: metadata.paths.metadata,
    metadata,
  };
}
