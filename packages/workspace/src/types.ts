export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type WorkspaceStatus =
  | "created"
  | "preparing"
  | "prepared"
  | "cleaning"
  | "cleaned"
  | "failed";

export type WorkspacePaths = {
  root: string;
  source: string;
  tmp: string;
  artifacts: string;
  metadata: string;
};

export type WorkspacePathKey = keyof WorkspacePaths;

export type WorkspaceMetadata = {
  id: string;
  runId?: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
  preparedAt?: string;
  cleanedAt?: string;
  paths: WorkspacePaths;
  source?: SourcePreparationMetadata;
  data?: JsonObject;
  lastError?: WorkspaceErrorSummary;
};

export type WorkspaceHandle = {
  id: string;
  runId?: string;
  rootPath: string;
  sourcePath: string;
  tmpPath: string;
  artifactsPath: string;
  metadataPath: string;
  metadata: WorkspaceMetadata;
};

export type PrepareWorkspaceOptions = {
  rootDir: string;
  source: SourceStrategy;
  id?: string;
  runId?: string;
  data?: JsonObject;
};

export type CreateWorkspaceOptions = {
  rootDir: string;
  id?: string;
  runId?: string;
  data?: JsonObject;
};

export type SourceStrategy = {
  kind: string;
  prepare(context: SourceStrategyContext): Promise<SourcePreparationResult>;
};

export type SourceStrategyContext = {
  workspace: WorkspaceHandle;
  paths: WorkspacePaths;
};

export type SourcePreparationResult = {
  metadata: SourcePreparationMetadata;
};

export type SourcePreparationMetadata =
  | CopySourceMetadata
  | GitWorktreeSourceMetadata
  | {
      kind: string;
      summary?: JsonObject;
    };

export type CopySourceMetadata = {
  kind: "copy";
  from: string;
};

export type GitWorktreeSourceMetadata = {
  kind: "git-worktree";
  repositoryPath: string;
  ref?: string;
  commit?: string;
  worktreePath: string;
};

export type WorkspaceErrorSummary = {
  code: WorkspaceErrorCode;
  message: string;
  path?: string;
};

export type WorkspaceErrorCode =
  | "WORKSPACE_EXISTS"
  | "WORKSPACE_NOT_FOUND"
  | "INVALID_WORKSPACE_PATH"
  | "SOURCE_PREPARE_FAILED"
  | "GIT_UNAVAILABLE"
  | "METADATA_READ_FAILED"
  | "METADATA_WRITE_FAILED"
  | "CLEANUP_FAILED";
