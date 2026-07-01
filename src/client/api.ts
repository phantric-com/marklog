import type {
  DiffResponse,
  DocumentRecord,
  GitPushResponse,
  NetworkInfo,
  PreviewResponse,
  Project,
  PublishResponse,
  Revision,
  RevisionDetail,
  WorkspaceStatus
} from "../shared/types.js";

type RequestOptions = {
  method?: string;
  body?: unknown;
};

export const api = {
  workspaceStatus: () => request<WorkspaceStatus>("/api/workspace/status"),
  networkInfo: () => request<NetworkInfo>("/api/network/urls"),
  initWorkspace: (path: string) =>
    request<WorkspaceStatus>("/api/workspace/init", {
      method: "POST",
      body: { path }
    }),
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (input: { name: string; description: string }) =>
    request<Project>("/api/projects", { method: "POST", body: input }),
  updateProject: (projectId: string, input: { name?: string; description?: string }) =>
    request<Project>(`/api/projects/${projectId}`, { method: "PATCH", body: input }),
  deleteProject: (projectId: string) =>
    request<Project>(`/api/projects/${projectId}`, { method: "DELETE", body: { confirm: true } }),
  pushProject: (projectId: string, input: { remote?: string; branch?: string } = {}) =>
    request<GitPushResponse>(`/api/projects/${projectId}/push`, { method: "POST", body: input }),
  listDocuments: (projectId: string) => request<DocumentRecord[]>(`/api/projects/${projectId}/documents`),
  createDocument: (projectId: string, input: { title: string; routePath?: string; currentDraft?: string }) =>
    request<DocumentRecord>(`/api/projects/${projectId}/documents`, { method: "POST", body: input }),
  getDocument: (documentId: string) => request<DocumentRecord>(`/api/documents/${documentId}`),
  updateDocument: (documentId: string, input: { title?: string; routePath?: string; status?: string; currentDraft?: string }) =>
    request<DocumentRecord>(`/api/documents/${documentId}`, { method: "PATCH", body: input }),
  archiveDocument: (documentId: string) =>
    request<DocumentRecord>(`/api/documents/${documentId}`, { method: "DELETE" }),
  preview: (documentId: string, source: string) =>
    request<PreviewResponse>(`/api/documents/${documentId}/preview`, { method: "POST", body: { source } }),
  publish: (documentId: string, input: { source: string; message: string }) =>
    request<PublishResponse>(`/api/documents/${documentId}/publish`, { method: "POST", body: input }),
  listRevisions: (documentId: string) => request<Revision[]>(`/api/documents/${documentId}/revisions`),
  getRevision: (revisionId: string) => request<RevisionDetail>(`/api/revisions/${revisionId}`),
  diff: (baseRevisionId: string, targetRevisionId: string) =>
    request<DiffResponse>("/api/revisions/diff", {
      method: "POST",
      body: { baseRevisionId, targetRevisionId }
    }),
  restore: (revisionId: string) =>
    request<DocumentRecord>(`/api/revisions/${revisionId}/restore`, { method: "POST" })
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}
