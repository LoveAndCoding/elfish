export { DispatcherError } from "./errors";
export type {
  Command,
  DispatchRequest,
  DispatchResult,
  DispatchTerminationReason,
  DispatcherErrorCode,
  DispatcherErrorSummary,
  ExecutedCommand,
} from "./types";

import { normalizeDispatchRequest } from "./normalize";
import { bunProcessRunner } from "./runner";
import type { DispatchRequest, DispatchResult } from "./types";

export async function dispatch(
  request: DispatchRequest,
): Promise<DispatchResult> {
  const normalized = normalizeDispatchRequest(request);
  return bunProcessRunner.run({
    command: normalized.command,
    executedCommand: normalized.executedCommand,
    idleTimeoutMs: request.idleTimeoutMs,
    wallClockTimeoutMs: request.wallClockTimeoutMs,
    signal: request.signal,
    stdoutLimitBytes: request.stdoutLimitBytes,
    stderrLimitBytes: request.stderrLimitBytes,
  });
}
