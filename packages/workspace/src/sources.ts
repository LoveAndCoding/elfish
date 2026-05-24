import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readlink,
  rm,
  symlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { WorkspaceError } from "./errors";
import { ensureGitRepository, git } from "./git";
import type { SourceStrategy } from "./types";

export function gitWorktreeSource(options: {
  repositoryPath: string;
  ref?: string;
}): SourceStrategy {
  const repositoryPath = resolve(options.repositoryPath);

  return {
    kind: "git-worktree",
    async prepare({ paths }) {
      await ensureGitRepository(repositoryPath);

      const entries = await readdir(paths.source);
      if (entries.length > 0) {
        throw new WorkspaceError(
          "SOURCE_PREPARE_FAILED",
          `Workspace source directory must be empty before creating git worktree: ${paths.source}`,
          { path: paths.source },
        );
      }

      await rm(paths.source, { recursive: true, force: true });
      await git(
        ["worktree", "add", "--detach", paths.source, options.ref ?? "HEAD"],
        { cwd: repositoryPath },
      );
      const commit = (
        await git(["rev-parse", "HEAD"], { cwd: paths.source })
      ).trim();

      return {
        metadata: {
          kind: "git-worktree",
          repositoryPath,
          ...(options.ref === undefined ? {} : { ref: options.ref }),
          commit,
          worktreePath: paths.source,
        },
      };
    },
  };
}

export function copySource(options: { from: string }): SourceStrategy {
  const from = resolve(options.from);

  return {
    kind: "copy",
    async prepare({ paths }) {
      const entries = await readdir(paths.source);
      if (entries.length > 0) {
        throw new WorkspaceError(
          "SOURCE_PREPARE_FAILED",
          `Workspace source directory must be empty before copying source: ${paths.source}`,
          { path: paths.source },
        );
      }

      await copyDirectoryContents(from, paths.source);
      return {
        metadata: {
          kind: "copy",
          from,
        },
      };
    },
  };
}

async function copyDirectoryContents(from: string, to: string): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const sourcePath = join(from, entry.name);
    const targetPath = join(to, entry.name);
    await copyEntry(sourcePath, targetPath);
  }
}

async function copyEntry(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  const stats = await lstat(sourcePath);

  if (stats.isSymbolicLink()) {
    await symlink(await readlink(sourcePath), targetPath);
    return;
  }

  if (stats.isDirectory()) {
    await mkdir(targetPath, { recursive: true });
    await copyDirectoryContents(sourcePath, targetPath);
    return;
  }

  if (stats.isFile()) {
    await copyFile(sourcePath, targetPath);
  }
}
