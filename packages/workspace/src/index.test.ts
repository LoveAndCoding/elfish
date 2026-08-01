import { afterEach, describe, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkspaceErrorCode } from "./index";
import {
  cleanupWorkspace,
  copySource,
  createWorkspace,
  gitWorktreeSource,
  prepareWorkspace,
  prepareWorkspaceSource,
  readWorkspaceMetadata,
  resolveWorkspacePath,
  resolveWorkspaceRelativePath,
  WorkspaceError,
  writeWorkspaceMetadata,
} from "./index";

const tempRoots: string[] = [];
const gitTest = (await gitAvailable()) ? test : test.skip;

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "elfish-workspace-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function expectWorkspaceError(
  action: Promise<unknown>,
  code: WorkspaceErrorCode,
): Promise<WorkspaceError> {
  let caught: unknown;
  try {
    await action;
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(WorkspaceError);
  expect((caught as WorkspaceError).code).toBe(code);
  return caught as WorkspaceError;
}

function expectWorkspaceThrow(
  action: () => unknown,
  code: WorkspaceErrorCode,
): WorkspaceError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(WorkspaceError);
  expect((caught as WorkspaceError).code).toBe(code);
  return caught as WorkspaceError;
}

describe("createWorkspace", () => {
  test("rejects caller-supplied IDs that cannot be used as path segments", async () => {
    const rootDir = await tempRoot();

    await expectWorkspaceError(
      createWorkspace({ rootDir, id: "../escape" }),
      "INVALID_WORKSPACE_PATH",
    );
  });

  test("creates the workspace layout and initial metadata on disk", async () => {
    const rootDir = await tempRoot();

    const handle = await createWorkspace({
      rootDir,
      id: "run_123",
      runId: "logical-run",
      data: { agent: "codex" },
    });

    expect(handle.id).toBe("run_123");
    expect(handle.runId).toBe("logical-run");
    expect(handle.rootPath).toBe(join(rootDir, "runs", "run_123"));
    expect(handle.sourcePath).toBe(join(handle.rootPath, "source"));
    expect(handle.tmpPath).toBe(join(handle.rootPath, "tmp"));
    expect(handle.artifactsPath).toBe(join(handle.rootPath, "artifacts"));
    expect(handle.metadataPath).toBe(join(handle.rootPath, "metadata.json"));

    expect((await stat(handle.sourcePath)).isDirectory()).toBe(true);
    expect((await stat(handle.tmpPath)).isDirectory()).toBe(true);
    expect((await stat(handle.artifactsPath)).isDirectory()).toBe(true);

    const persisted = await readWorkspaceMetadata(handle);
    expect(persisted).toEqual(handle.metadata);
    expect(persisted).toMatchObject({
      id: "run_123",
      runId: "logical-run",
      status: "created",
      data: { agent: "codex" },
      paths: {
        root: handle.rootPath,
        source: handle.sourcePath,
        tmp: handle.tmpPath,
        artifacts: handle.artifactsPath,
        metadata: handle.metadataPath,
      },
    });

    const raw = await readFile(handle.metadataPath, "utf8");
    expect(JSON.parse(raw)).toEqual(persisted);
  });

  test("rejects duplicate workspace IDs under the same root", async () => {
    const rootDir = await tempRoot();
    await createWorkspace({ rootDir, id: "duplicate" });

    await expectWorkspaceError(
      createWorkspace({ rootDir, id: "duplicate" }),
      "WORKSPACE_EXISTS",
    );
  });
});

describe("writeWorkspaceMetadata", () => {
  test("replaces caller data while preserving workspace-owned fields", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({
      rootDir,
      id: "metadata-test",
      runId: "run-a",
      data: { before: true },
    });

    const updated = await writeWorkspaceMetadata(handle, { after: "yes" });

    expect(updated.data).toEqual({ after: "yes" });
    expect(updated.id).toBe(handle.metadata.id);
    expect(updated.runId).toBe(handle.metadata.runId);
    expect(updated.paths).toEqual(handle.metadata.paths);
    expect(updated.createdAt).toBe(handle.metadata.createdAt);
    expect(updated.updatedAt).not.toBe(handle.metadata.updatedAt);
    await expect(readWorkspaceMetadata(handle)).resolves.toEqual(updated);
  });

  test("removes caller data when data is undefined", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({
      rootDir,
      id: "remove-data",
      data: { before: true },
    });

    const updated = await writeWorkspaceMetadata(handle, undefined);

    expect(updated.data).toBeUndefined();
    await expect(readWorkspaceMetadata(handle)).resolves.not.toHaveProperty(
      "data",
    );
  });
});

describe("workspace path resolution", () => {
  test("resolves known workspace paths from the handle", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "path-keys" });

    expect(resolveWorkspacePath(handle, "root")).toBe(handle.rootPath);
    expect(resolveWorkspacePath(handle, "source")).toBe(handle.sourcePath);
    expect(resolveWorkspacePath(handle, "tmp")).toBe(handle.tmpPath);
    expect(resolveWorkspacePath(handle, "artifacts")).toBe(
      handle.artifactsPath,
    );
    expect(resolveWorkspacePath(handle, "metadata")).toBe(handle.metadataPath);
  });

  test("resolves relative paths under the workspace root", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "relative-paths" });

    expect(
      resolveWorkspaceRelativePath(handle, "tmp/../artifacts/out.txt"),
    ).toBe(join(handle.rootPath, "artifacts", "out.txt"));
  });

  test("rejects absolute and escaping relative paths", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "path-escape" });

    expectWorkspaceThrow(
      () => resolveWorkspaceRelativePath(handle, "/etc/passwd"),
      "INVALID_WORKSPACE_PATH",
    );
    expectWorkspaceThrow(
      () => resolveWorkspaceRelativePath(handle, "../outside"),
      "INVALID_WORKSPACE_PATH",
    );
  });
});

describe("source preparation", () => {
  test("copySource copies source contents and records metadata", async () => {
    const rootDir = await tempRoot();
    const source = await tempRoot();
    await writeFile(join(source, "README.md"), "hello", "utf8");
    await writeFile(join(source, ".env.example"), "TOKEN=\n", "utf8");
    await mkdir(join(source, "src"), { recursive: true });
    await writeFile(join(source, "src", "index.ts"), "export {};\n", "utf8");
    await mkdir(join(source, "node_modules", "left-pad"), { recursive: true });
    await writeFile(
      join(source, "node_modules", "left-pad", "index.js"),
      "",
      "utf8",
    );
    await mkdir(join(source, ".git"), { recursive: true });
    await writeFile(
      join(source, ".git", "HEAD"),
      "ref: refs/heads/main\n",
      "utf8",
    );
    await symlink(join(source, "README.md"), join(source, "README.link"));

    const handle = await prepareWorkspace({
      rootDir,
      id: "copy-source",
      source: copySource({ from: source }),
    });

    expect(await readFile(join(handle.sourcePath, "README.md"), "utf8")).toBe(
      "hello",
    );
    expect(
      await readFile(join(handle.sourcePath, ".env.example"), "utf8"),
    ).toBe("TOKEN=\n");
    expect(
      await readFile(join(handle.sourcePath, "src", "index.ts"), "utf8"),
    ).toBe("export {};\n");
    expect(
      (await lstat(join(handle.sourcePath, "README.link"))).isSymbolicLink(),
    ).toBe(true);
    expect(await readdir(handle.sourcePath)).not.toContain("node_modules");
    expect(await readdir(handle.sourcePath)).not.toContain(".git");
    expect(handle.metadata.status).toBe("prepared");
    expect(handle.metadata.preparedAt).toEqual(expect.any(String));
    expect(handle.metadata.source).toEqual({ kind: "copy", from: source });
    await expect(readWorkspaceMetadata(handle)).resolves.toEqual(
      handle.metadata,
    );
  });

  test("prepareWorkspaceSource rejects workspaces that are not created", async () => {
    const rootDir = await tempRoot();
    const source = await tempRoot();
    const handle = await prepareWorkspace({
      rootDir,
      id: "already-prepared",
      source: copySource({ from: source }),
    });

    await expectWorkspaceError(
      prepareWorkspaceSource(handle, copySource({ from: source })),
      "SOURCE_PREPARE_FAILED",
    );
  });

  test("copySource fails when the workspace source directory is not empty", async () => {
    const rootDir = await tempRoot();
    const source = await tempRoot();
    await writeFile(join(source, "input.txt"), "copy me", "utf8");
    const handle = await createWorkspace({ rootDir, id: "dirty-source" });
    await writeFile(
      join(handle.sourcePath, "existing.txt"),
      "already here",
      "utf8",
    );

    await expectWorkspaceError(
      prepareWorkspaceSource(handle, copySource({ from: source })),
      "SOURCE_PREPARE_FAILED",
    );
  });

  test("failed source preparation records failed metadata before throwing", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "prepare-fails" });

    await expectWorkspaceError(
      prepareWorkspaceSource(handle, {
        kind: "explode",
        async prepare() {
          throw new Error("boom");
        },
      }),
      "SOURCE_PREPARE_FAILED",
    );

    const metadata = await readWorkspaceMetadata(handle);
    expect(metadata.status).toBe("failed");
    expect(metadata.lastError).toMatchObject({
      code: "SOURCE_PREPARE_FAILED",
      message: expect.stringContaining("boom"),
    });
  });
});

describe("cleanupWorkspace", () => {
  test("removes workspace state and is idempotent by default", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "cleanup-basic" });
    await writeFile(join(handle.tmpPath, "scratch.txt"), "temporary", "utf8");

    const cleaned = await cleanupWorkspace(handle);

    expect(cleaned.status).toBe("cleaned");
    expect(cleaned.cleanedAt).toEqual(expect.any(String));
    await expect(stat(handle.rootPath)).rejects.toThrow();

    const cleanedAgain = await cleanupWorkspace(handle);
    expect(cleanedAgain.status).toBe("cleaned");
  });

  test("can report missing workspaces as errors when requested", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "cleanup-missing" });
    await rm(handle.rootPath, { recursive: true, force: true });

    await expectWorkspaceError(
      cleanupWorkspace(handle, { missing: "error" }),
      "WORKSPACE_NOT_FOUND",
    );
  });

  test("cleans up a workspace after source preparation fails", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "cleanup-failed" });
    await expectWorkspaceError(
      prepareWorkspaceSource(handle, {
        kind: "explode",
        async prepare() {
          await writeFile(
            join(handle.tmpPath, "debug.txt"),
            "leftover",
            "utf8",
          );
          throw new Error("nope");
        },
      }),
      "SOURCE_PREPARE_FAILED",
    );

    const failed = await readWorkspaceMetadata(handle);
    expect(failed.status).toBe("failed");

    const cleaned = await cleanupWorkspace(handle);
    expect(cleaned.status).toBe("cleaned");
    await expect(stat(handle.rootPath)).rejects.toThrow();
  });

  test("records failed metadata when cleanup fails", async () => {
    const rootDir = await tempRoot();
    const handle = await createWorkspace({ rootDir, id: "cleanup-fails" });
    const prepared = await prepareWorkspaceSource(handle, {
      kind: "broken-git-cleanup",
      async prepare({ paths }) {
        return {
          metadata: {
            kind: "git-worktree",
            repositoryPath: rootDir,
            worktreePath: paths.source,
          },
        };
      },
    });

    const error = await expectWorkspaceError(
      cleanupWorkspace(prepared),
      "CLEANUP_FAILED",
    );

    expect(error.path).toBe(handle.rootPath);
    const metadata = await readWorkspaceMetadata(handle);
    expect(metadata.status).toBe("failed");
    expect(metadata.lastError).toMatchObject({
      code: "CLEANUP_FAILED",
      path: handle.rootPath,
    });
  });
});

describe("gitWorktreeSource", () => {
  gitTest("creates a detached git worktree for a checked-out ref", async () => {
    const rootDir = await tempRoot();
    const repositoryPath = await createTempGitRepository();

    const handle = await prepareWorkspace({
      rootDir,
      id: "git-main-ref",
      source: gitWorktreeSource({ repositoryPath, ref: "main" }),
    });

    expect(await readFile(join(handle.sourcePath, "tracked.txt"), "utf8")).toBe(
      "tracked\n",
    );
    expect(handle.metadata.source).toMatchObject({
      kind: "git-worktree",
      repositoryPath,
      ref: "main",
      worktreePath: handle.sourcePath,
    });
  });

  gitTest(
    "creates repeated default git worktrees from the same repository",
    async () => {
      const rootDir = await tempRoot();
      const repositoryPath = await createTempGitRepository();

      const first = await prepareWorkspace({
        rootDir,
        id: "git-default-one",
        source: gitWorktreeSource({ repositoryPath }),
      });
      const second = await prepareWorkspace({
        rootDir,
        id: "git-default-two",
        source: gitWorktreeSource({ repositoryPath }),
      });

      expect(
        await readFile(join(first.sourcePath, "tracked.txt"), "utf8"),
      ).toBe("tracked\n");
      expect(
        await readFile(join(second.sourcePath, "tracked.txt"), "utf8"),
      ).toBe("tracked\n");
    },
  );

  gitTest(
    "creates a git worktree and records the resolved commit",
    async () => {
      const rootDir = await tempRoot();
      const repositoryPath = await createTempGitRepository();

      const handle = await prepareWorkspace({
        rootDir,
        id: "git-source",
        source: gitWorktreeSource({ repositoryPath }),
      });

      const expectedCommit = await git(["rev-parse", "HEAD"], repositoryPath);
      expect(
        await readFile(join(handle.sourcePath, "tracked.txt"), "utf8"),
      ).toBe("tracked\n");
      expect(handle.metadata.source).toEqual({
        kind: "git-worktree",
        repositoryPath,
        commit: expectedCommit.trim(),
        worktreePath: handle.sourcePath,
      });
    },
  );

  gitTest(
    "cleanup removes git worktrees through git before removing workspace files",
    async () => {
      const rootDir = await tempRoot();
      const repositoryPath = await createTempGitRepository();
      const handle = await prepareWorkspace({
        rootDir,
        id: "git-cleanup",
        source: gitWorktreeSource({ repositoryPath }),
      });

      const cleaned = await cleanupWorkspace(handle);

      expect(cleaned.status).toBe("cleaned");
      await expect(stat(handle.rootPath)).rejects.toThrow();
      const worktrees = await git(
        ["worktree", "list", "--porcelain"],
        repositoryPath,
      );
      expect(worktrees).not.toContain(handle.sourcePath);
    },
  );
});

async function gitAvailable(): Promise<boolean> {
  try {
    await git(["--version"]);
    return true;
  } catch {
    return false;
  }
}

async function createTempGitRepository(): Promise<string> {
  const repositoryPath = await tempRoot();
  await git(["init"], repositoryPath);
  await git(["checkout", "-b", "main"], repositoryPath);
  await writeFile(join(repositoryPath, "tracked.txt"), "tracked\n", "utf8");
  await git(["add", "tracked.txt"], repositoryPath);
  await git(
    [
      "-c",
      "user.name=elfish tests",
      "-c",
      "user.email=elfish@example.invalid",
      "commit",
      "-m",
      "initial",
    ],
    repositoryPath,
  );
  return repositoryPath;
}

async function git(args: string[], cwd?: string): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  }

  return stdout;
}
