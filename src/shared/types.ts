export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  repoPath: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentStatus = "draft" | "published" | "archived";

export type DocumentRecord = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  routePath: string;
  status: DocumentStatus;
  currentDraft: string;
  createdAt: string;
  updatedAt: string;
};

export type Revision = {
  id: string;
  projectId: string;
  documentId: string;
  commitHash: string;
  versionLabel: string;
  title: string;
  message: string;
  sourcePath: string;
  htmlPath: string;
  createdAt: string;
};

export type ViewerComment = {
  id: string;
  projectId: string;
  documentId: string;
  revisionId: string;
  authorName: string;
  selectedText: string;
  anchor: ViewerCommentAnchor;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ViewerCommentAnchor = {
  sectionId: string | null;
  cssSelector: string | null;
  startOffset: number | null;
  endOffset: number | null;
  textBefore: string | null;
  textAfter: string | null;
};

export type GitStatus = {
  available: boolean;
  version: string | null;
  error: string | null;
};

export type WorkspaceStatus = {
  initialized: boolean;
  workspacePath: string | null;
  suggestedWorkspacePath: string;
  databasePath: string | null;
  git: GitStatus;
};

export type NetworkUrl = {
  label: string;
  address: string;
  url: string;
  kind: "current" | "lan" | "loopback";
};

export type NetworkInfo = {
  bindHost: string;
  port: number;
  lanAvailable: boolean;
  urls: NetworkUrl[];
};

export type PreviewResponse = {
  html: string;
};

export type RevisionDetail = {
  revision: Revision;
  source: string;
  html: string;
};

export type DiffLineType = "added" | "removed" | "unchanged";

export type DiffBlock = {
  type: DiffLineType;
  lines: string[];
};

export type DiffResponse = {
  baseRevision: Revision;
  targetRevision: Revision;
  blocks: DiffBlock[];
};

export type PublishResponse = {
  revision: Revision;
};

export type GitPushResponse = {
  projectId: string;
  remote: string;
  branch: string;
  pushed: boolean;
  output: string;
};

export type CommentExportResponse = {
  revisionId: string;
  path: string;
  commentCount: number;
  jsonl: string;
  committed: boolean;
  commitHash: string | null;
};

export type ReindexResponse = {
  projectId: string;
  indexPaths: string[];
  committed: boolean;
  commitHash: string | null;
};

export type ApiError = {
  error: string;
  details?: unknown;
};
