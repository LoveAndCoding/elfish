import type { WorkspaceErrorCode, WorkspaceErrorSummary } from "./types";

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;
  readonly path?: string;

  constructor(
    code: WorkspaceErrorCode,
    message: string,
    options?: { path?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "WorkspaceError";
    this.code = code;
    this.path = options?.path;
  }

  toSummary(): WorkspaceErrorSummary {
    return {
      code: this.code,
      message: this.message,
      ...(this.path === undefined ? {} : { path: this.path }),
    };
  }
}

export function workspaceErrorFromCause(
  code: WorkspaceErrorCode,
  message: string,
  cause: unknown,
  path?: string,
): WorkspaceError {
  if (cause instanceof WorkspaceError) {
    return cause;
  }

  const causeMessage =
    cause instanceof Error && cause.message.length > 0
      ? `${message}: ${cause.message}`
      : message;
  return new WorkspaceError(code, causeMessage, { path, cause });
}
