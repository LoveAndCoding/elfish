import { stat } from "node:fs/promises";

import { DispatcherError } from "./errors";
import type {
  DispatchResult,
  DispatchTerminationReason,
  ExecutedCommand,
  ResolvedCommand,
} from "./types";

const DEFAULT_OUTPUT_LIMIT_BYTES = 10 * 1024 * 1024;
const DEFAULT_TERMINATION_GRACE_MS = 30_000;
const LINUX_MAX_SINGLE_ARG_BYTES = 128 * 1024;

export type ProcessRunRequest = {
  command: ResolvedCommand;
  executedCommand: ExecutedCommand;
  idleTimeoutMs?: number;
  wallClockTimeoutMs?: number;
  signal?: AbortSignal;
  stdoutLimitBytes?: number;
  stderrLimitBytes?: number;
  terminationGraceMs?: number;
};

export interface ProcessRunner {
  run(request: ProcessRunRequest): Promise<DispatchResult>;
}

export const bunProcessRunner: ProcessRunner = {
  async run(request) {
    return runBunProcess(request);
  },
};

async function runBunProcess(
  request: ProcessRunRequest,
): Promise<DispatchResult> {
  if (request.signal?.aborted) {
    throw new DispatcherError(
      "DISPATCH_CANCELLED",
      "Dispatch was cancelled before the command started.",
      { command: request.executedCommand },
    );
  }

  const startTime = new Date();
  let process: Bun.Subprocess<"ignore", "pipe", "pipe">;
  const idleTimeoutMs = positiveNumberOrUndefined(request.idleTimeoutMs);
  const wallClockTimeoutMs = positiveNumberOrUndefined(
    request.wallClockTimeoutMs,
  );
  const stdoutLimitBytes =
    positiveNumberOrUndefined(request.stdoutLimitBytes) ??
    DEFAULT_OUTPUT_LIMIT_BYTES;
  const stderrLimitBytes =
    positiveNumberOrUndefined(request.stderrLimitBytes) ??
    DEFAULT_OUTPUT_LIMIT_BYTES;
  const terminationGraceMs =
    positiveNumberOrUndefined(request.terminationGraceMs) ??
    DEFAULT_TERMINATION_GRACE_MS;

  await validateCwd(request);

  try {
    process = Bun.spawn([request.command.program, ...request.command.args], {
      cwd: request.command.cwd,
      env: request.command.env,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
  } catch (error) {
    throw dispatcherErrorFromStartFailure(error, request);
  }

  let terminationReason: DispatchTerminationReason = "exited";
  let processDone = false;
  let idleTimeout: ReturnType<typeof setTimeout> | undefined;
  let wallClockTimeout: ReturnType<typeof setTimeout> | undefined;
  let forcedTermination: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (idleTimeout !== undefined) {
      clearTimeout(idleTimeout);
      idleTimeout = undefined;
    }
    if (wallClockTimeout !== undefined) {
      clearTimeout(wallClockTimeout);
      wallClockTimeout = undefined;
    }
    if (forcedTermination !== undefined) {
      clearTimeout(forcedTermination);
      forcedTermination = undefined;
    }
  };

  const stop = (reason: DispatchTerminationReason) => {
    if (terminationReason === "exited" && !processDone) {
      terminationReason = reason;
      process.kill("SIGTERM");
      forcedTermination = setTimeout(() => {
        if (!processDone) {
          process.kill("SIGKILL");
        }
      }, terminationGraceMs);
    }
  };

  const stopForOutputLimit = () => {
    if (terminationReason === "exited") {
      stop("output_limit_exceeded");
    }
  };

  const cancel = () => {
    stop("cancelled");
  };

  if (request.signal !== undefined) {
    request.signal.addEventListener("abort", cancel, { once: true });
  }

  const resetIdleTimeout = () => {
    if (idleTimeoutMs === undefined) {
      return;
    }

    if (idleTimeout !== undefined) {
      clearTimeout(idleTimeout);
    }

    idleTimeout = setTimeout(() => {
      stop("idle_timed_out");
    }, idleTimeoutMs);
  };

  resetIdleTimeout();

  if (wallClockTimeoutMs !== undefined) {
    wallClockTimeout = setTimeout(() => {
      stop("wall_clock_timed_out");
    }, wallClockTimeoutMs);
  }

  try {
    const stdout = readStreamText(process.stdout, stdoutLimitBytes, {
      onOutput: resetIdleTimeout,
      onLimitExceeded: stopForOutputLimit,
    });
    const stderr = readStreamText(process.stderr, stderrLimitBytes, {
      onOutput: resetIdleTimeout,
      onLimitExceeded: stopForOutputLimit,
    });

    const exitCode = await process.exited;
    processDone = true;
    clearTimers();
    const [stdoutResult, stderrResult] = await Promise.all([stdout, stderr]);
    const endTime = new Date();
    const signal = process.signalCode ?? null;

    if (terminationReason === "exited" && signal !== null) {
      terminationReason = "signaled";
    }

    return {
      command: request.executedCommand,
      stdout: stdoutResult.text,
      stderr: stderrResult.text,
      stdoutTruncated: stdoutResult.truncated,
      stderrTruncated: stderrResult.truncated,
      exitCode: terminationReason === "exited" ? exitCode : null,
      exitSignal: signal,
      terminationReason,
      startTime,
      endTime,
    };
  } finally {
    clearTimers();
    request.signal?.removeEventListener("abort", cancel);
  }
}

async function readStreamText(
  stream: ReadableStream<Uint8Array> | undefined,
  limitBytes: number,
  events: {
    onOutput(): void;
    onLimitExceeded(): void;
  },
): Promise<{ text: string; truncated: boolean }> {
  if (stream === undefined) {
    return { text: "", truncated: false };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let remaining = limitBytes;
  let text = "";
  let truncated = false;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      if (chunk.value.byteLength > 0) {
        events.onOutput();
      }

      if (remaining <= 0) {
        if (!truncated) {
          truncated = true;
          events.onLimitExceeded();
        }
        continue;
      }

      const value =
        chunk.value.byteLength > remaining
          ? chunk.value.subarray(0, remaining)
          : chunk.value;
      text += decoder.decode(value, { stream: true });
      remaining -= value.byteLength;

      if (value.byteLength < chunk.value.byteLength) {
        truncated = true;
        events.onLimitExceeded();
      }
    }
  } finally {
    reader.releaseLock();
  }

  text += decoder.decode();
  return { text, truncated };
}

async function validateCwd(request: ProcessRunRequest): Promise<void> {
  try {
    const cwd = await stat(request.command.cwd);
    if (!cwd.isDirectory()) {
      throw new DispatcherError(
        "INVALID_DISPATCH_REQUEST",
        `Command cwd must be a directory: ${request.command.cwd}`,
        { command: request.executedCommand },
      );
    }
  } catch (error) {
    if (error instanceof DispatcherError) {
      throw error;
    }

    throw new DispatcherError(
      "INVALID_DISPATCH_REQUEST",
      `Command cwd is unavailable: ${request.command.cwd}`,
      { command: request.executedCommand, cause: error },
    );
  }
}

function dispatcherErrorFromStartFailure(
  cause: unknown,
  request: ProcessRunRequest,
): DispatcherError {
  const systemCode = systemErrorCode(cause);
  const message = cause instanceof Error ? cause.message : String(cause);

  if (systemCode === "ENOENT") {
    return new DispatcherError(
      "COMMAND_UNAVAILABLE",
      `Command is unavailable: ${request.command.program}`,
      { command: request.executedCommand, cause },
    );
  }

  if (systemCode === "EACCES") {
    return new DispatcherError(
      "COMMAND_NOT_READABLE",
      `Command cannot be read or executed: ${request.command.program}`,
      { command: request.executedCommand, cause },
    );
  }

  if (systemCode === "EPERM" || systemCode === "ENOEXEC") {
    return new DispatcherError(
      "COMMAND_NOT_EXECUTABLE",
      `Command is not executable: ${request.command.program}`,
      { command: request.executedCommand, cause },
    );
  }

  if (systemCode === "ENAMETOOLONG") {
    return new DispatcherError(
      "COMMAND_TOO_LONG",
      "Command path is too long for the system.",
      { command: request.executedCommand, cause },
    );
  }

  if (systemCode === "E2BIG") {
    const hasOversizedArg = request.command.args.some(
      (arg) => byteLength(arg) >= LINUX_MAX_SINGLE_ARG_BYTES,
    );
    const hasOversizedEnv = Object.entries(request.command.env).some(
      ([name, value]) =>
        byteLength(name) + byteLength(value) >= LINUX_MAX_SINGLE_ARG_BYTES,
    );
    return new DispatcherError(
      hasOversizedArg
        ? "ARGUMENT_TOO_LONG"
        : hasOversizedEnv
          ? "ENVIRONMENT_TOO_LONG"
          : "COMMAND_TOO_LONG",
      "Command arguments or environment are too long for the system.",
      { command: request.executedCommand, cause },
    );
  }

  return new DispatcherError("COMMAND_START_FAILED", message, {
    command: request.executedCommand,
    cause,
  });
}

function systemErrorCode(cause: unknown): string | undefined {
  if (cause !== null && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function positiveNumberOrUndefined(
  value: number | undefined,
): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
