import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { WorkspaceError, workspaceErrorFromCause } from "./errors";
import { pathExists, writeJsonFile } from "./fs";
import {
  handleFromMetadata,
  validateWorkspaceId,
  workspacePaths,
} from "./identity";
import {
  nextUpdatedAt,
  readWorkspaceMetadata,
  writeOwnedMetadata,
} from "./metadata";
import { removeGitWorktree } from "./git";
import type {
  CreateWorkspaceOptions,
  GitWorktreeSourceMetadata,
  PrepareWorkspaceOptions,
  SourcePreparationMetadata,
  SourceStrategy,
  WorkspaceHandle,
  WorkspaceMetadata,
} from "./types";

export async function createWorkspace(
  options: CreateWorkspaceOptions,
): Promise<WorkspaceHandle> {
  const id = options.id ?? randomUUID();
  validateWorkspaceId(id);

  const rootDir = resolve(options.rootDir);
  const paths = workspacePaths(rootDir, id);
  if (await pathExists(paths.root)) {
    throw new WorkspaceError(
      "WORKSPACE_EXISTS",
      `Workspace already exists: ${id}`,
      { path: paths.root },
    );
  }

  const now = new Date().toISOString();
  const metadata: WorkspaceMetadata = {
    id,
    ...(options.runId === undefined ? {} : { runId: options.runId }),
    status: "created",
    createdAt: now,
    updatedAt: now,
    paths,
    ...(options.data === undefined ? {} : { data: options.data }),
  };

  try {
    await mkdir(paths.source, { recursive: true });
    await mkdir(paths.tmp, { recursive: true });
    await mkdir(paths.artifacts, { recursive: true });
    await writeJsonFile(paths.metadata, metadata);
  } catch (cause) {
    throw new WorkspaceError(
      "METADATA_WRITE_FAILED",
      `Failed to create workspace metadata for ${id}`,
      { path: paths.metadata, cause },
    );
  }

  return handleFromMetadata(metadata);
}

export async function prepareWorkspace(
  options: PrepareWorkspaceOptions,
): Promise<WorkspaceHandle> {
  const handle = await createWorkspace(options);
  return prepareWorkspaceSource(handle, options.source);
}

export async function prepareWorkspaceSource(
  handle: WorkspaceHandle,
  source: SourceStrategy,
): Promise<WorkspaceHandle> {
  const current = await readWorkspaceMetadata(handle);
  if (current.status !== "created") {
    throw new WorkspaceError(
      "SOURCE_PREPARE_FAILED",
      `Workspace ${current.id} cannot prepare source from status ${current.status}`,
      { path: current.paths.root },
    );
  }

  await writeOwnedMetadata({
    ...current,
    status: "preparing",
    updatedAt: nextUpdatedAt(current.updatedAt),
  });

  try {
    const result = await source.prepare({
      workspace: handleFromMetadata({
        ...current,
        status: "preparing",
      }),
      paths: current.paths,
    });
    const now = new Date().toISOString();
    const prepared: WorkspaceMetadata = {
      ...current,
      status: "prepared",
      updatedAt: now,
      preparedAt: now,
      source: result.metadata,
    };
    await writeOwnedMetadata(prepared);
    return handleFromMetadata(prepared);
  } catch (cause) {
    const error = workspaceErrorFromCause(
      "SOURCE_PREPARE_FAILED",
      `Failed to prepare source for workspace ${current.id}`,
      cause,
      current.paths.source,
    );
    const failed: WorkspaceMetadata = {
      ...current,
      status: "failed",
      updatedAt: nextUpdatedAt(current.updatedAt),
      lastError: error.toSummary(),
    };
    await writeOwnedMetadata(failed);
    throw error;
  }
}

export async function cleanupWorkspace(
  handle: WorkspaceHandle,
  options?: { missing?: "ignore" | "error" },
): Promise<WorkspaceMetadata> {
  const missing = options?.missing ?? "ignore";
  let current: WorkspaceMetadata;

  try {
    current = await readWorkspaceMetadata(handle);
  } catch (cause) {
    if (missing === "ignore" && !(await pathExists(handle.rootPath))) {
      return cleanedMetadata(handle.metadata);
    }

    throw new WorkspaceError(
      "WORKSPACE_NOT_FOUND",
      `Workspace ${handle.id} does not exist`,
      { path: handle.rootPath, cause },
    );
  }

  if (current.status === "cleaned") {
    return current;
  }

  const cleaning: WorkspaceMetadata = {
    ...current,
    status: "cleaning",
    updatedAt: nextUpdatedAt(current.updatedAt),
  };

  try {
    await writeOwnedMetadata(cleaning);
    if (isGitWorktreeSourceMetadata(cleaning.source)) {
      await removeGitWorktree(
        cleaning.source.repositoryPath,
        cleaning.source.worktreePath,
      );
    }

    const cleaned = cleanedMetadata(cleaning);
    await rm(cleaning.paths.root, { recursive: true, force: true });
    return cleaned;
  } catch (cause) {
    const causeMessage =
      cause instanceof Error && cause.message.length > 0
        ? `Failed to cleanup workspace ${current.id}: ${cause.message}`
        : `Failed to cleanup workspace ${current.id}`;
    const error = new WorkspaceError("CLEANUP_FAILED", causeMessage, {
      path: current.paths.root,
      cause,
    });
    const failed: WorkspaceMetadata = {
      ...current,
      status: "failed",
      updatedAt: nextUpdatedAt(current.updatedAt),
      lastError: error.toSummary(),
    };

    try {
      if (await pathExists(current.paths.root)) {
        await writeOwnedMetadata(failed);
      }
    } catch {
      // Preserve the original cleanup failure.
    }

    throw error;
  }
}

function cleanedMetadata(metadata: WorkspaceMetadata): WorkspaceMetadata {
  const cleanedAt = new Date().toISOString();
  return {
    ...metadata,
    status: "cleaned",
    updatedAt: cleanedAt,
    cleanedAt,
  };
}

function isGitWorktreeSourceMetadata(
  metadata: SourcePreparationMetadata | undefined,
): metadata is GitWorktreeSourceMetadata {
  const candidate = metadata as
    | { kind?: unknown; repositoryPath?: unknown; worktreePath?: unknown }
    | undefined;

  return (
    candidate?.kind === "git-worktree" &&
    typeof candidate.repositoryPath === "string" &&
    typeof candidate.worktreePath === "string"
  );
}
