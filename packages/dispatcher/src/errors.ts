import type {
  DispatcherErrorCode,
  DispatcherErrorSummary,
  ExecutedCommand,
} from "./types";

export class DispatcherError extends Error {
  readonly code: DispatcherErrorCode;
  readonly command?: ExecutedCommand;

  constructor(
    code: DispatcherErrorCode,
    message: string,
    options?: { command?: ExecutedCommand; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "DispatcherError";
    this.code = code;
    this.command = options?.command;
  }

  toSummary(): DispatcherErrorSummary {
    return {
      code: this.code,
      message: this.message,
      ...(this.command === undefined ? {} : { command: this.command }),
    };
  }
}
