import type { WorkspaceHandle } from "@elfish/workspace";

export type Command = {
  program: string;
  args?: readonly string[];
  /**
   * Complete child-process environment.
   *
   * Dispatcher does not inherit the CLI process environment. Undefined values
   * are omitted, which is useful when callers build env objects conditionally.
   */
  env?: Readonly<Record<string, string | undefined>>;
  /** Workspace-relative cwd. Defaults to the prepared workspace source path. */
  cwd?: string;
};

export type ResolvedCommand = {
  program: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
  cwd: string;
};

export type ExecutedCommand = {
  program: string;
  args: readonly string[];
  cwd: string;
};

export type DispatchRequest = {
  workspace: WorkspaceHandle;
  command: Command;
  /**
   * Stops the command after this many milliseconds without stdout/stderr.
   * Non-positive, infinite, and NaN values are ignored.
   */
  idleTimeoutMs?: number;
  /**
   * Fallback maximum runtime in milliseconds.
   * Non-positive, infinite, and NaN values are ignored.
   */
  wallClockTimeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Maximum captured stdout bytes. The command is stopped when exceeded.
   * Non-positive, infinite, and NaN values use the dispatcher default.
   */
  stdoutLimitBytes?: number;
  /**
   * Maximum captured stderr bytes. The command is stopped when exceeded.
   * Non-positive, infinite, and NaN values use the dispatcher default.
   */
  stderrLimitBytes?: number;
};

export type DispatchTerminationReason =
  | "exited"
  | "signaled"
  | "idle_timed_out"
  | "wall_clock_timed_out"
  | "cancelled"
  | "output_limit_exceeded";

export type DispatchResult = {
  command: ExecutedCommand;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  exitCode: number | null;
  exitSignal: string | null;
  terminationReason: DispatchTerminationReason;
  startTime: Date;
  endTime: Date;
};

export type DispatcherErrorCode =
  | "INVALID_DISPATCH_REQUEST"
  | "COMMAND_UNAVAILABLE"
  | "COMMAND_NOT_EXECUTABLE"
  | "COMMAND_NOT_READABLE"
  | "COMMAND_TOO_LONG"
  | "ARGUMENT_TOO_LONG"
  | "ENVIRONMENT_TOO_LONG"
  | "COMMAND_START_FAILED"
  | "DISPATCH_CANCELLED";

export type DispatcherErrorSummary = {
  code: DispatcherErrorCode;
  message: string;
  command?: ExecutedCommand;
};
