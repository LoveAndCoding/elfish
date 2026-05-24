import { isAbsolute, relative, resolve } from "node:path";

import { WorkspaceError } from "./errors";
import type { WorkspaceHandle, WorkspacePathKey } from "./types";

export function resolveWorkspacePath(
  handle: WorkspaceHandle,
  key: WorkspacePathKey,
): string {
  return handle.metadata.paths[key];
}

export function resolveWorkspaceRelativePath(
  handle: WorkspaceHandle,
  relativePath: string,
): string {
  if (isAbsolute(relativePath)) {
    throw new WorkspaceError(
      "INVALID_WORKSPACE_PATH",
      `Workspace relative path must not be absolute: ${relativePath}`,
      { path: relativePath },
    );
  }

  const resolved = resolve(handle.rootPath, relativePath);
  const fromRoot = relative(handle.rootPath, resolved);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new WorkspaceError(
      "INVALID_WORKSPACE_PATH",
      `Workspace relative path escapes workspace root: ${relativePath}`,
      { path: relativePath },
    );
  }

  return resolved;
}
