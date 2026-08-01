import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkspaceErrorCode } from "@elfish/workspace";
import {
  copySource,
  prepareWorkspace,
  WorkspaceError,
} from "@elfish/workspace";
import { DispatcherError, type DispatcherErrorCode, dispatch } from "./index";
import { normalizeDispatchRequest } from "./normalize";
import { bunProcessRunner } from "./runner";

const tempRoots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "elfish-dispatcher-"));
  tempRoots.push(root);
  return root;
}

async function preparedWorkspace() {
  const rootDir = await tempRoot();
  const source = await mkdtemp(join(tmpdir(), "elfish-dispatcher-source-"));
  tempRoots.push(source);
  await writeFile(join(source, "README.md"), "dispatcher test source\n");

  return prepareWorkspace({
    rootDir,
    source: copySource({ from: source }),
  });
}

async function expectDispatcherError(
  action: Promise<unknown>,
  codes: DispatcherErrorCode | readonly DispatcherErrorCode[],
): Promise<DispatcherError> {
  const expected = Array.isArray(codes) ? codes : [codes];
  let caught: unknown;

  try {
    await action;
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(DispatcherError);
  expect(expected).toContain((caught as DispatcherError).code);
  return caught as DispatcherError;
}

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

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("dispatch", () => {
  test("runs a command in the prepared workspace source path", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "console.log(process.cwd()); console.error(process.env.ELFISH_TEST_ENV);",
        ],
        env: { ELFISH_TEST_ENV: "env-ok" },
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.exitSignal).toBeNull();
    expect(result.terminationReason).toBe("exited");
    expect(result.stdout.trim()).toBe(workspace.sourcePath);
    expect(result.stderr.trim()).toBe("env-ok");
    expect(result.command.cwd).toBe(workspace.sourcePath);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
  });

  test("does not inherit the CLI environment by default", async () => {
    const workspace = await preparedWorkspace();
    process.env.ELFISH_DISPATCHER_SECRET = "secret";

    try {
      const result = await dispatch({
        workspace,
        command: {
          program: process.execPath,
          args: [
            "-e",
            "console.log(process.env.ELFISH_DISPATCHER_SECRET ?? 'missing');",
          ],
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("missing");
    } finally {
      delete process.env.ELFISH_DISPATCHER_SECRET;
    }
  });

  test("rejects a command with no program", async () => {
    const workspace = await preparedWorkspace();

    await expectDispatcherError(
      dispatch({
        workspace,
        command: { program: "   " },
      }),
      "INVALID_DISPATCH_REQUEST",
    );
  });

  test("rejects a missing workspace-relative cwd as an invalid request", async () => {
    const workspace = await preparedWorkspace();

    await expectDispatcherError(
      dispatch({
        workspace,
        command: {
          program: process.execPath,
          args: ["-e", "process.exit(0);"],
          cwd: "missing",
        },
      }),
      "INVALID_DISPATCH_REQUEST",
    );
  });

  test("returns nonzero exits as dispatch results", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: ["-e", "console.error('failed'); process.exit(7);"],
      },
    });

    expect(result.exitCode).toBe(7);
    expect(result.terminationReason).toBe("exited");
    expect(result.stderr.trim()).toBe("failed");
  });

  test("reports missing executables as typed errors", async () => {
    const workspace = await preparedWorkspace();

    await expectDispatcherError(
      dispatch({
        workspace,
        command: { program: "elfish-missing-command-for-dispatcher-tests" },
      }),
      "COMMAND_UNAVAILABLE",
    );
  });

  test("reports unreadable or non-executable programs as typed errors", async () => {
    const workspace = await preparedWorkspace();
    const program = join(workspace.sourcePath, "not-executable");
    await writeFile(program, "#!/usr/bin/env bash\necho no\n");
    await chmod(program, 0o644);

    await expectDispatcherError(
      dispatch({
        workspace,
        command: { program },
      }),
      ["COMMAND_NOT_READABLE", "COMMAND_NOT_EXECUTABLE"],
    );
  });

  test("reports platform argv limits as typed errors", async () => {
    const workspace = await preparedWorkspace();

    await expectDispatcherError(
      dispatch({
        workspace,
        command: {
          program: process.execPath,
          args: ["-e", "process.exit(0)", "x".repeat(4 * 1024 * 1024)],
        },
      }),
      ["ARGUMENT_TOO_LONG", "COMMAND_TOO_LONG"],
    );
  });

  test("terminates commands that stop making progress", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: ["-e", "console.log('started'); setTimeout(() => {}, 10_000);"],
      },
      idleTimeoutMs: 150,
    });

    expect(result.stdout.trim()).toBe("started");
    expect(result.terminationReason).toBe("idle_timed_out");
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).not.toBeNull();
  });

  test("keeps running while commands produce output before the idle timeout", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "let count = 0; const timer = setInterval(() => { console.log(++count); if (count === 3) { clearInterval(timer); } }, 20);",
        ],
      },
      idleTimeoutMs: 200,
    });

    expect(result.terminationReason).toBe("exited");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual(["1", "2", "3"]);
  });

  test("uses a wall-clock timeout as a fallback for commands that keep producing output", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: ["-e", "setInterval(() => console.log('progress'), 20);"],
      },
      idleTimeoutMs: 200,
      wallClockTimeoutMs: 150,
    });

    expect(result.stdout).toContain("progress");
    expect(result.terminationReason).toBe("wall_clock_timed_out");
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).not.toBeNull();
  });

  test("stops commands when captured output exceeds the byte limit", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "console.log('x'.repeat(1024)); setTimeout(() => {}, 10_000);",
        ],
      },
      stdoutLimitBytes: 16,
    });

    expect(result.terminationReason).toBe("output_limit_exceeded");
    expect(result.stdoutTruncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(16);
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).not.toBeNull();
  });

  test("stops commands when captured stderr exceeds the byte limit", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "console.error('x'.repeat(1024)); setTimeout(() => {}, 10_000);",
        ],
      },
      stderrLimitBytes: 16,
    });

    expect(result.terminationReason).toBe("output_limit_exceeded");
    expect(result.stdoutTruncated).toBe(false);
    expect(result.stderrTruncated).toBe(true);
    expect(result.stderr.length).toBeLessThanOrEqual(16);
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).not.toBeNull();
  });

  test("does not provide inherited stdin to commands", async () => {
    const workspace = await preparedWorkspace();

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "let input = ''; process.stdin.on('data', (chunk) => { input += chunk; }); process.stdin.on('end', () => console.log(input.length));",
        ],
      },
      idleTimeoutMs: 200,
    });

    expect(result.terminationReason).toBe("exited");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("0");
  });

  test("terminates commands when the caller aborts", async () => {
    const workspace = await preparedWorkspace();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const result = await dispatch({
      workspace,
      command: {
        program: process.execPath,
        args: ["-e", "setTimeout(() => {}, 10_000);"],
      },
      signal: controller.signal,
    });

    expect(result.terminationReason).toBe("cancelled");
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).not.toBeNull();
  });

  test("rejects dispatch when the caller already aborted", async () => {
    const workspace = await preparedWorkspace();
    const controller = new AbortController();
    controller.abort();

    await expectDispatcherError(
      dispatch({
        workspace,
        command: {
          program: process.execPath,
          args: ["-e", "console.log('should not run');"],
        },
        signal: controller.signal,
      }),
      "DISPATCH_CANCELLED",
    );
  });

  test("force kills commands that ignore graceful termination", async () => {
    const workspace = await preparedWorkspace();
    const normalized = normalizeDispatchRequest({
      workspace,
      command: {
        program: process.execPath,
        args: [
          "-e",
          "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 10_000);",
        ],
      },
    });

    const result = await bunProcessRunner.run({
      command: normalized.command,
      executedCommand: normalized.executedCommand,
      idleTimeoutMs: 150,
      terminationGraceMs: 25,
    });

    expect(result.stdout.trim()).toBe("ready");
    expect(result.terminationReason).toBe("idle_timed_out");
    expect(result.exitCode).toBeNull();
    expect(result.exitSignal).toBe("SIGKILL");
  });

  test("rejects cwd values that escape the workspace", async () => {
    const workspace = await preparedWorkspace();

    await expectWorkspaceError(
      dispatch({
        workspace,
        command: {
          program: process.execPath,
          args: ["-e", "process.exit(0);"],
          cwd: "../outside",
        },
      }),
      "INVALID_WORKSPACE_PATH",
    );
  });
});
