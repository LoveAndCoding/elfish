import { WorkspaceError } from "./errors";
import { pathExists } from "./fs";

export async function ensureGitRepository(
  repositoryPath: string,
): Promise<void> {
  try {
    const result = (
      await git(["rev-parse", "--is-inside-work-tree"], {
        cwd: repositoryPath,
      })
    ).trim();
    if (result !== "true") {
      throw new Error(`Not a git repository: ${repositoryPath}`);
    }
  } catch (cause) {
    throw new WorkspaceError(
      "GIT_UNAVAILABLE",
      `Git repository is not available at ${repositoryPath}`,
      { path: repositoryPath, cause },
    );
  }
}

export async function removeGitWorktree(
  repositoryPath: string,
  worktreePath: string,
): Promise<void> {
  if (!(await pathExists(worktreePath))) {
    return;
  }

  await git(["worktree", "remove", "--force", worktreePath], {
    cwd: repositoryPath,
  });
}

export async function git(
  args: string[],
  options?: { cwd?: string },
): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new WorkspaceError(
      "GIT_UNAVAILABLE",
      `git ${args.join(" ")} failed: ${stderr.trim()}`,
      { path: options?.cwd },
    );
  }

  return stdout;
}
