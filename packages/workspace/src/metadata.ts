import { readFile } from "node:fs/promises";

import { WorkspaceError } from "./errors";
import { writeJsonFile } from "./fs";
import type { JsonObject, WorkspaceHandle, WorkspaceMetadata } from "./types";

export async function readWorkspaceMetadata(
  handleOrPath: WorkspaceHandle | string,
): Promise<WorkspaceMetadata> {
  const metadataPath =
    typeof handleOrPath === "string" ? handleOrPath : handleOrPath.metadataPath;

  try {
    return JSON.parse(
      await readFile(metadataPath, "utf8"),
    ) as WorkspaceMetadata;
  } catch (cause) {
    throw new WorkspaceError(
      "METADATA_READ_FAILED",
      `Failed to read workspace metadata at ${metadataPath}`,
      { path: metadataPath, cause },
    );
  }
}

export async function writeWorkspaceMetadata(
  handleOrPath: WorkspaceHandle | string,
  data: JsonObject | undefined,
): Promise<WorkspaceMetadata> {
  const current = await readWorkspaceMetadata(handleOrPath);

  try {
    const { data: _removedData, ...metadataWithoutData } = current;
    const updated: WorkspaceMetadata = {
      ...metadataWithoutData,
      ...(data === undefined ? {} : { data }),
      updatedAt: nextUpdatedAt(current.updatedAt),
    };

    await writeJsonFile(current.paths.metadata, updated);
    return updated;
  } catch (cause) {
    if (cause instanceof WorkspaceError) {
      throw cause;
    }

    throw new WorkspaceError(
      "METADATA_WRITE_FAILED",
      `Failed to write workspace metadata at ${current.paths.metadata}`,
      { path: current.paths.metadata, cause },
    );
  }
}

export async function writeOwnedMetadata(
  metadata: WorkspaceMetadata,
): Promise<void> {
  await writeJsonFile(metadata.paths.metadata, metadata);
}

export function nextUpdatedAt(previous: string): string {
  const now = new Date();
  const previousTime = Date.parse(previous);
  if (Number.isFinite(previousTime) && now.getTime() <= previousTime) {
    return new Date(previousTime + 1).toISOString();
  }

  return now.toISOString();
}
