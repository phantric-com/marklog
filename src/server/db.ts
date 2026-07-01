import { DatabaseSync } from "node:sqlite";

import type {
  DocumentRecord,
  DocumentStatus,
  Project,
  Revision,
  ViewerComment,
  ViewerCommentAnchor
} from "../shared/types.js";

type SqlValue = string | number | bigint | null | Uint8Array;

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  repoPath: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentRow = {
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

type RevisionRow = {
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

type ViewerCommentRow = {
  id: string;
  projectId: string;
  documentId: string;
  revisionId: string;
  authorName: string;
  selectedText: string;
  anchorJson: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  id: string;
  name: string;
  slug: string;
  description: string;
  repoPath: string;
  now: string;
};

export type CreateDocumentInput = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  routePath: string;
  currentDraft: string;
  now: string;
};

export type CreateRevisionInput = {
  id: string;
  projectId: string;
  documentId: string;
  commitHash: string;
  versionLabel: string;
  title: string;
  message: string;
  sourcePath: string;
  htmlPath: string;
  now: string;
};

export type CreateViewerCommentInput = {
  id: string;
  projectId: string;
  documentId: string;
  revisionId: string;
  authorName: string;
  selectedText: string;
  anchor: ViewerCommentAnchor;
  note: string;
  now: string;
};

export class MarklogDb {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  listProjects(): Project[] {
    return this.all<ProjectRow>(
      `SELECT id, name, slug, description, repo_path AS repoPath, created_at AS createdAt, updated_at AS updatedAt
       FROM projects
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC`
    );
  }

  getProject(id: string): Project | null {
    return (
      this.get<ProjectRow>(
        `SELECT id, name, slug, description, repo_path AS repoPath, created_at AS createdAt, updated_at AS updatedAt
         FROM projects
         WHERE id = ? AND deleted_at IS NULL`,
        id
      ) ?? null
    );
  }

  createProject(input: CreateProjectInput): Project {
    this.run(
      `INSERT INTO projects (id, name, slug, description, repo_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.name,
      input.slug,
      input.description,
      input.repoPath,
      input.now,
      input.now
    );
    const project = this.getProject(input.id);
    if (!project) {
      throw new Error("Project insert failed");
    }
    return project;
  }

  updateProject(id: string, input: { name?: string; description?: string; now: string }): Project {
    const current = this.requireProject(id);
    this.run(
      `UPDATE projects
       SET name = ?, slug = ?, description = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      input.name ?? current.name,
      input.name ? slugify(input.name) : current.slug,
      input.description ?? current.description,
      input.now,
      id
    );
    return this.requireProject(id);
  }

  archiveProject(id: string, now: string): Project {
    const project = this.requireProject(id);
    this.run(
      `UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      now,
      now,
      id
    );
    this.run(`UPDATE documents SET status = 'archived', updated_at = ? WHERE project_id = ?`, now, id);
    return project;
  }

  listDocuments(projectId: string): DocumentRecord[] {
    return this.all<DocumentRow>(
      `SELECT id, project_id AS projectId, title, slug, route_path AS routePath, status, current_draft AS currentDraft, created_at AS createdAt, updated_at AS updatedAt
       FROM documents
       WHERE project_id = ? AND status != 'archived'
       ORDER BY route_path ASC, updated_at DESC`,
      projectId
    );
  }

  getDocument(id: string): DocumentRecord | null {
    return (
      this.get<DocumentRow>(
        `SELECT id, project_id AS projectId, title, slug, route_path AS routePath, status, current_draft AS currentDraft, created_at AS createdAt, updated_at AS updatedAt
         FROM documents
         WHERE id = ?`,
        id
      ) ?? null
    );
  }

  getDocumentByProjectRoutePath(projectId: string, routePath: string): DocumentRecord | null {
    return (
      this.get<DocumentRow>(
        `SELECT id, project_id AS projectId, title, slug, route_path AS routePath, status, current_draft AS currentDraft, created_at AS createdAt, updated_at AS updatedAt
         FROM documents
         WHERE project_id = ? AND route_path = ? AND status != 'archived'
         ORDER BY updated_at DESC
         LIMIT 1`,
        projectId,
        routePath
      ) ?? null
    );
  }

  documentRoutePathExists(projectId: string, routePath: string, exceptDocumentId?: string): boolean {
    const row = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM documents
       WHERE project_id = ? AND route_path = ? AND status != 'archived' AND id != ?`,
      projectId,
      routePath,
      exceptDocumentId ?? ""
    );
    return (row?.count ?? 0) > 0;
  }

  createDocument(input: CreateDocumentInput): DocumentRecord {
    this.run(
      `INSERT INTO documents (id, project_id, title, slug, route_path, status, current_draft, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      input.id,
      input.projectId,
      input.title,
      input.slug,
      input.routePath,
      input.currentDraft,
      input.now,
      input.now
    );
    return this.requireDocument(input.id);
  }

  updateDocument(
    id: string,
    input: { title?: string; routePath?: string; status?: DocumentStatus; currentDraft?: string; now: string }
  ): DocumentRecord {
    const current = this.requireDocument(id);
    this.run(
      `UPDATE documents
       SET title = ?, slug = ?, route_path = ?, status = ?, current_draft = ?, updated_at = ?
       WHERE id = ?`,
      input.title ?? current.title,
      input.title ? slugify(input.title) : current.slug,
      input.routePath ?? current.routePath,
      input.status ?? current.status,
      input.currentDraft ?? current.currentDraft,
      input.now,
      id
    );
    return this.requireDocument(id);
  }

  archiveDocument(id: string, now: string): DocumentRecord {
    return this.updateDocument(id, { status: "archived", now });
  }

  createRevision(input: CreateRevisionInput): Revision {
    this.run(
      `INSERT INTO revisions
         (id, project_id, document_id, commit_hash, version_label, title, message, source_path, html_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.projectId,
      input.documentId,
      input.commitHash,
      input.versionLabel,
      input.title,
      input.message,
      input.sourcePath,
      input.htmlPath,
      input.now
    );
    return this.requireRevision(input.id);
  }

  listRevisions(documentId: string): Revision[] {
    return this.all<RevisionRow>(
      `SELECT id, project_id AS projectId, document_id AS documentId, commit_hash AS commitHash,
              version_label AS versionLabel, title, message, source_path AS sourcePath, html_path AS htmlPath,
              created_at AS createdAt
       FROM revisions
       WHERE document_id = ?
       ORDER BY created_at DESC`,
      documentId
    );
  }

  getLatestRevision(documentId: string): Revision | null {
    return (
      this.get<RevisionRow>(
        `SELECT id, project_id AS projectId, document_id AS documentId, commit_hash AS commitHash,
                version_label AS versionLabel, title, message, source_path AS sourcePath, html_path AS htmlPath,
                created_at AS createdAt
         FROM revisions
         WHERE document_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        documentId
      ) ?? null
    );
  }

  getRevision(id: string): Revision | null {
    return (
      this.get<RevisionRow>(
        `SELECT id, project_id AS projectId, document_id AS documentId, commit_hash AS commitHash,
                version_label AS versionLabel, title, message, source_path AS sourcePath, html_path AS htmlPath,
                created_at AS createdAt
         FROM revisions
         WHERE id = ?`,
        id
      ) ?? null
    );
  }

  getRevisionByDocumentRef(documentId: string, revisionRef: string): Revision | null {
    const normalizedRef = normalizeRevisionRef(revisionRef);
    const trimmedRef = revisionRef.trim().toLowerCase();
    const allowCommitMatch = normalizedRef === trimmedRef;
    return (
      this.get<RevisionRow>(
        `SELECT id, project_id AS projectId, document_id AS documentId, commit_hash AS commitHash,
                version_label AS versionLabel, title, message, source_path AS sourcePath, html_path AS htmlPath,
                created_at AS createdAt
         FROM revisions
         WHERE document_id = ?
           AND (id = ? OR version_label = ? OR commit_hash = ? OR commit_hash LIKE ?)
         ORDER BY created_at DESC
         LIMIT 1`,
        documentId,
        revisionRef,
        normalizedRef,
        allowCommitMatch ? revisionRef : "",
        allowCommitMatch ? `${revisionRef}%` : ""
      ) ?? null
    );
  }

  nextVersionLabel(documentId: string): string {
    const row = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM revisions WHERE document_id = ?`,
      documentId
    );
    return `v${(row?.count ?? 0) + 1}`;
  }

  listViewerComments(revisionId: string): ViewerComment[] {
    return this.all<ViewerCommentRow>(
      `SELECT id, project_id AS projectId, document_id AS documentId, revision_id AS revisionId,
              author_name AS authorName, selected_text AS selectedText, anchor_json AS anchorJson, note,
              created_at AS createdAt, updated_at AS updatedAt
       FROM viewer_comments
       WHERE revision_id = ?
       ORDER BY created_at ASC`,
      revisionId
    ).map(viewerCommentFromRow);
  }

  createViewerComment(input: CreateViewerCommentInput): ViewerComment {
    this.run(
      `INSERT INTO viewer_comments
         (id, project_id, document_id, revision_id, author_name, selected_text, anchor_json, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.projectId,
      input.documentId,
      input.revisionId,
      input.authorName,
      input.selectedText,
      JSON.stringify(input.anchor),
      input.note,
      input.now,
      input.now
    );
    return this.requireViewerComment(input.id);
  }

  getViewerComment(id: string): ViewerComment | null {
    const row = this.get<ViewerCommentRow>(
      `SELECT id, project_id AS projectId, document_id AS documentId, revision_id AS revisionId,
              author_name AS authorName, selected_text AS selectedText, anchor_json AS anchorJson, note,
              created_at AS createdAt, updated_at AS updatedAt
       FROM viewer_comments
       WHERE id = ?`,
      id
    );
    return row ? viewerCommentFromRow(row) : null;
  }

  requireProject(id: string): Project {
    const project = this.getProject(id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    return project;
  }

  requireDocument(id: string): DocumentRecord {
    const document = this.getDocument(id);
    if (!document) {
      throw new NotFoundError("Document not found");
    }
    return document;
  }

  requireDocumentByProjectRoutePath(projectId: string, routePath: string): DocumentRecord {
    const document = this.getDocumentByProjectRoutePath(projectId, routePath);
    if (!document) {
      throw new NotFoundError("Document not found for project path");
    }
    return document;
  }

  requireRevision(id: string): Revision {
    const revision = this.getRevision(id);
    if (!revision) {
      throw new NotFoundError("Revision not found");
    }
    return revision;
  }

  requireLatestRevision(documentId: string): Revision {
    const revision = this.getLatestRevision(documentId);
    if (!revision) {
      throw new NotFoundError("Published revision not found");
    }
    return revision;
  }

  requireRevisionByDocumentRef(documentId: string, revisionRef: string): Revision {
    const revision = this.getRevisionByDocumentRef(documentId, revisionRef);
    if (!revision) {
      throw new NotFoundError("Revision not found for document");
    }
    return revision;
  }

  requireViewerComment(id: string): ViewerComment {
    const comment = this.getViewerComment(id);
    if (!comment) {
      throw new NotFoundError("Viewer comment not found");
    }
    return comment;
  }

  private migrate(): void {
    this.dropLegacyViewerCommentsTable();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        repo_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        route_path TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
        current_draft TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        commit_hash TEXT NOT NULL,
        version_label TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        source_path TEXT NOT NULL,
        html_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS viewer_comments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL DEFAULT 'Viewer',
        selected_text TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_revisions_document_id ON revisions(document_id);
      CREATE INDEX IF NOT EXISTS idx_revisions_commit_hash ON revisions(commit_hash);
      CREATE INDEX IF NOT EXISTS idx_viewer_comments_revision_id ON viewer_comments(revision_id);
    `);
    this.ensureColumn("documents", "route_path", "TEXT NOT NULL DEFAULT ''");
    this.run(`UPDATE documents SET route_path = slug WHERE route_path = ''`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_project_route_path ON documents(project_id, route_path)`);
  }

  private dropLegacyViewerCommentsTable(): void {
    const columns = this.all<{ name: string }>("PRAGMA table_info(viewer_comments)");
    if (columns.length > 0 && !columns.some((column) => column.name === "anchor_json")) {
      this.db.exec("DROP TABLE viewer_comments");
    }
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    const columns = this.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private all<T>(sql: string, ...params: SqlValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  private get<T>(sql: string, ...params: SqlValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  private run(sql: string, ...params: SqlValue[]): void {
    this.db.prepare(sql).run(...params);
  }
}

function viewerCommentFromRow(row: ViewerCommentRow): ViewerComment {
  return {
    id: row.id,
    projectId: row.projectId,
    documentId: row.documentId,
    revisionId: row.revisionId,
    authorName: row.authorName,
    selectedText: row.selectedText,
    anchor: parseCommentAnchor(row.anchorJson),
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseCommentAnchor(value: string): ViewerCommentAnchor {
  try {
    const parsed = JSON.parse(value) as Partial<ViewerCommentAnchor>;
    return normalizeCommentAnchor(parsed);
  } catch {
    return normalizeCommentAnchor({});
  }
}

function normalizeCommentAnchor(value: Partial<ViewerCommentAnchor>): ViewerCommentAnchor {
  return {
    sectionId: stringOrNull(value.sectionId),
    cssSelector: stringOrNull(value.cssSelector),
    startOffset: numberOrNull(value.startOffset),
    endOffset: numberOrNull(value.endOffset),
    textBefore: stringOrNull(value.textBefore),
    textAfter: stringOrNull(value.textAfter)
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export function normalizeRevisionRef(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return /^\d+$/.test(trimmed) ? `v${trimmed}` : trimmed;
}
