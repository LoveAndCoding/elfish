export { WorkspaceError } from "./errors";
export {
  cleanupWorkspace,
  createWorkspace,
  prepareWorkspace,
  prepareWorkspaceSource,
} from "./lifecycle";
export { readWorkspaceMetadata, writeWorkspaceMetadata } from "./metadata";
export { resolveWorkspacePath, resolveWorkspaceRelativePath } from "./paths";
export { copySource, gitWorktreeSource } from "./sources";
export type {
  CopySourceMetadata,
  CreateWorkspaceOptions,
  GitWorktreeSourceMetadata,
  JsonObject,
  JsonValue,
  PrepareWorkspaceOptions,
  SourcePreparationMetadata,
  SourcePreparationResult,
  SourceStrategy,
  SourceStrategyContext,
  WorkspaceErrorCode,
  WorkspaceErrorSummary,
  WorkspaceHandle,
  WorkspaceMetadata,
  WorkspacePathKey,
  WorkspacePaths,
  WorkspaceStatus,
} from "./types";
