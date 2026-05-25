import { resolveWorkspaceRelativePath } from "@elfish/workspace";

import { DispatcherError } from "./errors";
import type {
  Command,
  DispatchRequest,
  ExecutedCommand,
  ResolvedCommand,
} from "./types";

type NormalizedDispatch = {
  command: ResolvedCommand;
  executedCommand: ExecutedCommand;
};

export function normalizeDispatchRequest(
  request: DispatchRequest,
): NormalizedDispatch {
  const command = validateCommand(request.command);
  const cwd =
    command.cwd === undefined
      ? request.workspace.sourcePath
      : resolveWorkspaceRelativePath(request.workspace, command.cwd);
  const env = mergeEnv(command.env);
  const args = [...(command.args ?? [])];

  return {
    command: {
      program: command.program,
      args,
      env,
      cwd,
    },
    executedCommand: {
      program: command.program,
      args,
      cwd,
    },
  };
}

function validateCommand(
  command: Command,
): Required<Pick<Command, "program">> & Omit<Command, "program"> {
  if (typeof command.program !== "string" || command.program.trim() === "") {
    throw new DispatcherError(
      "INVALID_DISPATCH_REQUEST",
      "Command program must be a non-empty string.",
    );
  }

  if (
    command.args !== undefined &&
    (!Array.isArray(command.args) ||
      command.args.some((arg) => typeof arg !== "string"))
  ) {
    throw new DispatcherError(
      "INVALID_DISPATCH_REQUEST",
      "Command args must be an array of strings.",
    );
  }

  if (command.env !== undefined) {
    for (const [name, value] of Object.entries(command.env)) {
      if (typeof name !== "string" || name.length === 0) {
        throw new DispatcherError(
          "INVALID_DISPATCH_REQUEST",
          "Command env names must be non-empty strings.",
        );
      }

      if (value !== undefined && typeof value !== "string") {
        throw new DispatcherError(
          "INVALID_DISPATCH_REQUEST",
          `Command env value for ${name} must be a string or undefined.`,
        );
      }
    }
  }

  if (command.cwd !== undefined && typeof command.cwd !== "string") {
    throw new DispatcherError(
      "INVALID_DISPATCH_REQUEST",
      "Command cwd must be a workspace-relative string.",
    );
  }

  return command;
}

function mergeEnv(
  overrides: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<string, string>> {
  const merged: Record<string, string> = {};

  for (const [name, value] of Object.entries(overrides ?? {})) {
    if (value !== undefined) {
      merged[name] = value;
    }
  }

  return merged;
}
