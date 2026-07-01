import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import fastify, { FastifyInstance, FastifyReply } from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { diffLines } from "diff";
import QRCode from "qrcode";

import { MarklogDb, NotFoundError, slugify } from "./db.js";
import {
  generateAiFolderIndexes,
  isGeneratedAiFolderIndex,
  type AiFolderIndexFile,
  type AiIndexEntry
} from "./folder-index.js";
import { gitFor, configureLocalGitIdentity } from "./git.js";
import {
  extractPlanningSections,
  normalizePlanningDocument,
  planningSectionContract,
  preparePlanningHtml,
  starterHtmlDocument
} from "./renderer.js";
import { injectViewerChrome } from "./viewer.js";
import { WorkspaceManager, WorkspaceNotInitializedError } from "./workspace.js";
import { ensureInside, repositoriesPathFor } from "./paths.js";
import type {
  ApiError,
  CommentExportResponse,
  DiffBlock,
  DiffLineType,
  DocumentStatus,
  DocumentRecord,
  GitPushResponse,
  NetworkInfo,
  NetworkUrl,
  Project,
  ReindexResponse,
  Revision,
  RevisionDetail,
  ViewerCommentAnchor
} from "../shared/types.js";

export type CreateAppOptions = {
  configDir?: string;
  workspacePath?: string;
  devServer?: boolean;
  staticDir?: string | null;
  logger?: boolean;
  bindHost?: string;
  port?: number;
};

type BodyRecord = Record<string, unknown>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({ logger: options.logger ?? false });
  const workspace = new WorkspaceManager({
    configDir: options.configDir,
    workspacePath: options.workspacePath
  });
  await workspace.loadConfiguredWorkspace();

  app.addHook("onClose", async () => {
    workspace.close();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof WorkspaceNotInitializedError) {
      void reply.status(409).send({ error: error.message } satisfies ApiError);
      return;
    }
    if (error instanceof NotFoundError) {
      void reply.status(404).send({ error: error.message } satisfies ApiError);
      return;
    }
    if (error instanceof ValidationError) {
      void reply.status(400).send({ error: error.message } satisfies ApiError);
      return;
    }
    app.log.error(error);
    void reply.status(500).send({
      error: error instanceof Error ? error.message : "Internal server error"
    } satisfies ApiError);
  });

  registerApiRoutes(app, workspace, {
    bindHost: options.bindHost ?? process.env.HOST ?? "127.0.0.1",
    port: options.port ?? Number(process.env.PORT ?? 3333)
  });

  const useDevServer = options.devServer ?? process.env.NODE_ENV !== "production";
  if (useDevServer) {
    await app.register(fastifyMiddie);
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.addHook("onClose", async () => {
      await vite.close();
    });
    app.use(vite.middlewares);
  } else if (options.staticDir !== null) {
    const staticRoot = options.staticDir ?? path.resolve(__dirname, "../client");
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: "/"
    });
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith("/api/") && acceptsHtml(request.headers.accept)) {
        void reply.type("text/html").sendFile("index.html");
        return;
      }
      void reply.status(404).send({ error: "Not found" } satisfies ApiError);
    });
  }

  return app;
}

function registerApiRoutes(
  app: FastifyInstance,
  workspace: WorkspaceManager,
  serverInfo: { bindHost: string; port: number }
): void {
  app.get("/api/workspace/status", async () => workspace.status());

  app.get("/api/network/urls", async (request) => {
    return networkInfo(serverInfo, request.headers.host);
  });

  app.get("/api/qr.svg", async (request, reply) => {
    const url = requiredString(asBody(request.query), "url");
    validateShareUrl(url);
    const svg = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256
    });
    return reply.type("image/svg+xml; charset=utf-8").send(svg);
  });

  app.post("/api/workspace/init", async (request) => {
    const body = asBody(request.body);
    return workspace.initialize(optionalString(body, "path"));
  });

  app.get("/api/projects", async () => workspace.requireDb().listProjects());

  app.post("/api/projects", async (request) => {
    const body = asBody(request.body);
    const name = requiredString(body, "name");
    const description = optionalString(body, "description") ?? "";
    const db = workspace.requireDb();
    const workspacePath = workspace.requireWorkspacePath();
    const id = randomUUID();
    const repoPath = ensureInside(repositoriesPathFor(workspacePath), path.join(repositoriesPathFor(workspacePath), id));
    await fs.mkdir(repoPath, { recursive: true });
    const git = gitFor(repoPath);
    await git.init();
    await configureLocalGitIdentity(git);
    return db.createProject({
      id,
      name,
      slug: slugify(name),
      description,
      repoPath,
      now: now()
    });
  });

  app.get("/api/projects/:projectId", async (request) => {
    const db = workspace.requireDb();
    return db.requireProject(param(request.params, "projectId"));
  });

  app.patch("/api/projects/:projectId", async (request) => {
    const body = asBody(request.body);
    return workspace.requireDb().updateProject(param(request.params, "projectId"), {
      name: optionalString(body, "name"),
      description: optionalString(body, "description"),
      now: now()
    });
  });

  app.delete("/api/projects/:projectId", async (request) => {
    const body = asBody(request.body);
    const query = asBody(request.query);
    if (body.confirm !== true && query.confirm !== "true") {
      throw new ValidationError("Project deletion requires confirm=true");
    }
    return workspace.requireDb().archiveProject(param(request.params, "projectId"), now());
  });

  app.post("/api/projects/:projectId/push", async (request): Promise<GitPushResponse> => {
    const body = asBody(request.body);
    const project = workspace.requireDb().requireProject(param(request.params, "projectId"));
    const remote = optionalString(body, "remote")?.trim() || "origin";
    const git = gitFor(project.repoPath);
    const remotes = await git.getRemotes(true);
    if (!remotes.some((entry) => entry.name === remote)) {
      throw new ValidationError(`Git remote '${remote}' is not configured for this project`);
    }
    const branch = optionalString(body, "branch")?.trim() || (await git.raw(["branch", "--show-current"])).trim();
    if (!branch) {
      throw new ValidationError("Git branch is required because the project repository has no current branch");
    }
    const output = await git.raw(["push", remote, branch]);
    return {
      projectId: project.id,
      remote,
      branch,
      pushed: true,
      output
    };
  });

  app.post("/api/projects/:projectId/reindex", async (request): Promise<ReindexResponse> => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const projectId = param(request.params, "projectId");
    const project = db.requireProject(projectId);
    const generatedAt = now();
    const indexFiles = generateAiFolderIndexes({
      projectId: project.id,
      projectName: project.name,
      generatedAt,
      entries: buildAiIndexEntries(db, project.id)
    });
    const indexPaths = await syncAiFolderIndexes(project.repoPath, indexFiles);

    let committed = false;
    let commitHash: string | null = null;
    if (body.commit === true && indexPaths.length > 0) {
      const git = gitFor(project.repoPath);
      await configureLocalGitIdentity(git);
      await git.raw(["add", "--all", "--", ...indexPaths]);
      if (await hasStagedChanges(git)) {
        await git.raw(["commit", "-m", "Reindex: AI folder indexes"]);
        committed = true;
        commitHash = (await git.raw(["rev-parse", "HEAD"])).trim();
      }
    }

    return {
      projectId: project.id,
      indexPaths,
      committed,
      commitHash
    };
  });

  app.get("/api/projects/:projectId/documents", async (request) => {
    const db = workspace.requireDb();
    const projectId = param(request.params, "projectId");
    db.requireProject(projectId);
    return db.listDocuments(projectId);
  });

  app.post("/api/projects/:projectId/documents", async (request) => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const projectId = param(request.params, "projectId");
    const project = db.requireProject(projectId);
    const title = requiredString(body, "title");
    const routePath = normalizeDocumentRoutePath(optionalString(body, "routePath"), title);
    if (db.documentRoutePathExists(projectId, routePath)) {
      throw new ValidationError("Document route path already exists in this project");
    }
    const createdAt = now();
    const document = db.createDocument({
      id: randomUUID(),
      projectId,
      title,
      slug: slugify(title),
      routePath,
      currentDraft: optionalString(body, "currentDraft") ?? starterHtmlDocument(title),
      now: createdAt
    });
    await ensureDraftDocumentPackage(project, document, createdAt);
    return document;
  });

  app.get("/api/documents/:documentId", async (request) => {
    return workspace.requireDb().requireDocument(param(request.params, "documentId"));
  });

  app.patch("/api/documents/:documentId", async (request) => {
    const body = asBody(request.body);
    const status = optionalStatus(body, "status");
    const db = workspace.requireDb();
    const document = db.requireDocument(param(request.params, "documentId"));
    const routePath =
      "routePath" in body
        ? normalizeDocumentRoutePath(optionalString(body, "routePath"), optionalString(body, "title") ?? document.title)
        : undefined;
    if (routePath && db.documentRoutePathExists(document.projectId, routePath, document.id)) {
      throw new ValidationError("Document route path already exists in this project");
    }
    return db.updateDocument(document.id, {
      title: optionalString(body, "title"),
      routePath,
      status,
      currentDraft: optionalString(body, "currentDraft"),
      now: now()
    });
  });

  app.delete("/api/documents/:documentId", async (request) => {
    return workspace.requireDb().archiveDocument(param(request.params, "documentId"), now());
  });

  app.post("/api/documents/:documentId/preview", async (request) => {
    const body = asBody(request.body);
    const document = workspace.requireDb().requireDocument(param(request.params, "documentId"));
    return {
      html: preparePlanningHtml({
        title: document.title,
        html: optionalString(body, "source") ?? document.currentDraft
      })
    };
  });

  app.post("/api/documents/:documentId/publish", async (request) => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const document = db.requireDocument(param(request.params, "documentId"));
    const project = db.requireProject(document.projectId);
    const message = optionalString(body, "message") ?? "";
    const sourceHtml = optionalString(body, "source") ?? document.currentDraft;
    const publishedAt = now();
    const revisionId = randomUUID();
    const versionLabel = db.nextVersionLabel(document.id);
    const packagePaths = documentPackagePaths(document.routePath);
    const sourcePath = packagePaths.sourcePath;
    const htmlPath = packagePaths.htmlPath;
    const manifestPath = packagePaths.manifestPath;
    const documentRelDir = document.routePath;
    const html = attachPackageStylesheet(preparePlanningHtml({
      title: document.title,
      html: sourceHtml,
      publishedAt,
      versionLabel
    }));
    const manifest = {
      schema_version: 2,
      kind: "marklog.document.package",
      revision_id: revisionId,
      document_id: document.id,
      version_label: versionLabel,
      title: document.title,
      route_path: document.routePath,
      package_path: `${document.routePath}/`,
      entry: "index.html",
      ai_index: "INDEX.md",
      message,
      status: "published",
      published_at: publishedAt,
      public_url: projectPageHref(project.id, document.routePath),
      source_path: sourcePath,
      html_path: htmlPath,
      css_path: packagePaths.cssPath,
      package_index_path: packagePaths.packageIndexPath,
      mock_path: packagePaths.mockPath,
      assets_path: packagePaths.assetsPath,
      paths: {
        entry: packagePaths.htmlPath,
        stylesheet: packagePaths.cssPath,
        source: packagePaths.sourcePath,
        manifest: packagePaths.manifestPath,
        ai_index: packagePaths.packageIndexPath,
        mock: packagePaths.mockPath,
        assets: packagePaths.assetsPath
      },
      geo: geoMetadata(project, document, publishedAt, "reviewed"),
      review: emptyReviewMetadata(),
      sections: extractPlanningSections(html),
      section_contract: planningSectionContract()
    };

    await writeRepoFile(project.repoPath, sourcePath, sourceHtml);
    await writeRepoFile(project.repoPath, htmlPath, html);
    await writeRepoFile(project.repoPath, packagePaths.cssPath, packageCss());
    await writeRepoFile(project.repoPath, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeRepoFile(project.repoPath, `${packagePaths.mockPath}/README.md`, mockReadme(document));
    await writeRepoFile(project.repoPath, `${packagePaths.assetsPath}/README.md`, assetsReadme(document));
    const indexFiles = generateAiFolderIndexes({
      projectId: project.id,
      projectName: project.name,
      generatedAt: publishedAt,
      entries: buildAiIndexEntries(db, project.id, {
        document,
        versionLabel,
        publishedAt,
        ...packagePaths
      })
    });
    const indexPaths = await syncAiFolderIndexes(project.repoPath, indexFiles);

    const git = gitFor(project.repoPath);
    await configureLocalGitIdentity(git);
    const hadHead = await hasHead(git);
    try {
      await git.raw(["add", "--all", "--", documentRelDir, ...indexPaths]);
      const subject = `Publish: ${document.title} ${versionLabel}`;
      const bodyText = [`document_id: ${document.id}`, `revision_id: ${revisionId}`, "status: published"];
      if (message) {
        bodyText.push(`message: ${message}`);
      }
      await git.raw(["commit", "--allow-empty", "-m", subject, "-m", bodyText.join("\n")]);
    } catch (error) {
      await rollbackRepoPaths(project.repoPath, [documentRelDir, ...indexPaths], hadHead);
      throw error;
    }

    const commitHash = (await git.raw(["rev-parse", "HEAD"])).trim();
    const revision = db.createRevision({
      id: revisionId,
      projectId: project.id,
      documentId: document.id,
      commitHash,
      versionLabel,
      title: document.title,
      message,
      sourcePath,
      htmlPath,
      now: publishedAt
    });
    db.updateDocument(document.id, { currentDraft: sourceHtml, status: "published", now: publishedAt });
    return { revision };
  });

  app.get("/api/documents/:documentId/revisions", async (request) => {
    const db = workspace.requireDb();
    const documentId = param(request.params, "documentId");
    db.requireDocument(documentId);
    return db.listRevisions(documentId);
  });

  app.get("/api/revisions/:revisionId/comments", async (request) => {
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    return db.listViewerComments(revision.id);
  });

  app.post("/api/revisions/:revisionId/comments", async (request) => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    return db.createViewerComment({
      id: randomUUID(),
      projectId: revision.projectId,
      documentId: revision.documentId,
      revisionId: revision.id,
      authorName: boundedString(optionalString(body, "authorName")?.trim() || "Viewer", "authorName", 80),
      selectedText: boundedString(requiredString(body, "selectedText"), "selectedText", 2000),
      anchor: commentAnchorFromBody(body),
      note: boundedString(requiredString(body, "note"), "note", 4000),
      now: now()
    });
  });

  app.post("/api/revisions/:revisionId/comments/export", async (request): Promise<CommentExportResponse> => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    const project = db.requireProject(revision.projectId);
    const comments = db.listViewerComments(revision.id);
    const jsonl = comments
      .map((comment) =>
        JSON.stringify({
          schema_version: 1,
          exported_at: now(),
          revision: {
            id: revision.id,
            document_id: revision.documentId,
            version_label: revision.versionLabel,
            commit_hash: revision.commitHash,
            title: revision.title
          },
          comment
        })
      )
      .join("\n");
    const output = jsonl ? `${jsonl}\n` : "";
    const exportPath = `.marklog/comments/${revision.id}.jsonl`;
    await writeRepoFile(project.repoPath, exportPath, output);

    let committed = false;
    let commitHash: string | null = null;
    if (body.commit === true) {
      const git = gitFor(project.repoPath);
      await configureLocalGitIdentity(git);
      await git.raw(["add", "--", exportPath]);
      if (await hasStagedChanges(git)) {
        await git.raw(["commit", "-m", `Export comments: ${revision.title} ${revision.versionLabel}`]);
        committed = true;
        commitHash = (await git.raw(["rev-parse", "HEAD"])).trim();
      }
    }

    return {
      revisionId: revision.id,
      path: exportPath,
      commentCount: comments.length,
      jsonl: output,
      committed,
      commitHash
    };
  });

  app.post("/api/revisions/diff", async (request) => {
    const body = asBody(request.body);
    const db = workspace.requireDb();
    const baseRevision = db.requireRevision(requiredString(body, "baseRevisionId"));
    const targetRevision = db.requireRevision(requiredString(body, "targetRevisionId"));
    if (baseRevision.documentId !== targetRevision.documentId) {
      throw new ValidationError("Revisions must belong to the same document");
    }
    const baseSource = await readRevisionFile(db.requireProject(baseRevision.projectId).repoPath, baseRevision, "source");
    const targetSource = await readRevisionFile(
      db.requireProject(targetRevision.projectId).repoPath,
      targetRevision,
      "source"
    );
    const blocks: DiffBlock[] = diffLines(baseSource, targetSource).map((part) => ({
      type: part.added ? "added" : part.removed ? "removed" : ("unchanged" satisfies DiffLineType),
      lines: splitDiffLines(part.value)
    }));
    return { baseRevision, targetRevision, blocks };
  });

  app.get("/api/revisions/:revisionId", async (request): Promise<RevisionDetail> => {
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    const project = db.requireProject(revision.projectId);
    const [source, html] = await Promise.all([
      readRevisionFile(project.repoPath, revision, "source"),
      readRevisionFile(project.repoPath, revision, "html")
    ]);
    return { revision, source, html };
  });

  app.post("/api/revisions/:revisionId/restore", async (request) => {
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    const project = db.requireProject(revision.projectId);
    const source = await readRevisionFile(project.repoPath, revision, "source");
    return db.updateDocument(revision.documentId, {
      currentDraft: source,
      status: "draft",
      now: now()
    });
  });

  app.get("/api/revisions/:revisionId/html", async (request, reply) => {
    const db = workspace.requireDb();
    const revision = db.requireRevision(param(request.params, "revisionId"));
    const project = db.requireProject(revision.projectId);
    const html = await readRevisionFile(project.repoPath, revision, "html");
    const query = asBody(request.query);
    if (query.download === "1" || query.download === "true") {
      reply.header("Content-Disposition", `attachment; filename="${revision.versionLabel}-${revision.documentId}.html"`);
      return reply.type("text/html; charset=utf-8").send(html);
    }
    return sendViewerHtml(reply, html, revision);
  });

  app.get("/p/:documentId", async (request, reply) => {
    const db = workspace.requireDb();
    const documentId = param(request.params, "documentId");
    db.requireDocument(documentId);
    const revision = db.requireLatestRevision(documentId);
    const project = db.requireProject(revision.projectId);
    const html = await readRevisionFile(project.repoPath, revision, "html");
    return sendViewerHtml(reply, html, revision);
  });

  app.get("/p/:documentId/:revisionRef", async (request, reply) => {
    const db = workspace.requireDb();
    const documentId = param(request.params, "documentId");
    const revisionRef = param(request.params, "revisionRef");
    db.requireDocument(documentId);
    const revision = db.requireRevisionByDocumentRef(documentId, revisionRef);
    const project = db.requireProject(revision.projectId);
    const html = await readRevisionFile(project.repoPath, revision, "html");
    return sendViewerHtml(reply, html, revision);
  });

  app.get("/projects/:projectId/*", async (request, reply) => {
    const db = workspace.requireDb();
    const projectId = param(request.params, "projectId");
    db.requireProject(projectId);
    const wildcard = wildcardParam(request.params);
    const routePath = normalizePublicRoutePath(wildcard);
    if (!routePath) {
      return reply.redirect(`/projects/${encodeURIComponent(projectId)}`);
    }
    const revisionRef = optionalString(asBody(request.query), "revision") ?? optionalString(asBody(request.query), "v");

    const document = db.getDocumentByProjectRoutePath(projectId, routePath);
    if (!document) {
      const packageAsset = resolvePackageAssetRequest(db, projectId, wildcard);
      if (!packageAsset) {
        throw new NotFoundError("Document not found for project path");
      }
      const revision = revisionRef
        ? db.requireRevisionByDocumentRef(packageAsset.document.id, revisionRef)
        : db.requireLatestRevision(packageAsset.document.id);
      const project = db.requireProject(revision.projectId);
      const assetPath = `${packageAsset.document.routePath}/${packageAsset.assetPath}`;
      const contents = await readRevisionAsset(project.repoPath, revision, assetPath, packageAsset.assetPath);
      return reply.type(contentTypeForAsset(packageAsset.assetPath)).send(contents);
    }

    const revision = revisionRef
      ? db.requireRevisionByDocumentRef(document.id, revisionRef)
      : db.requireLatestRevision(document.id);
    const project = db.requireProject(revision.projectId);
    const html = await readRevisionFile(project.repoPath, revision, "html");
    return sendViewerHtml(reply, html, revision);
  });
}

function sendViewerHtml(reply: FastifyReply, html: string, revision: Revision) {
  const normalizedHtml = normalizePlanningDocument(html);
  const packagePath = packagePathFromRevision(revision);
  const cssHref = `${projectPageHref(revision.projectId, packagePath)}/index.css?revision=${encodeURIComponent(
    revision.versionLabel
  )}`;
  return reply.type("text/html; charset=utf-8").send(
    injectViewerChrome(rewritePackageStylesheetHref(normalizedHtml, cssHref), {
      projectId: revision.projectId,
      documentId: revision.documentId,
      revisionId: revision.id,
      versionLabel: revision.versionLabel,
      title: revision.title,
      commentsApi: `/api/revisions/${encodeURIComponent(revision.id)}/comments`
    })
  );
}

function rewritePackageStylesheetHref(html: string, cssHref: string): string {
  if (html.includes("data-marklog-package-stylesheet")) {
    return html.replace(
      /(<link\b(?=[^>]*data-marklog-package-stylesheet)[^>]*\bhref=)["'][^"']*["']/i,
      `$1"${cssHref}"`
    );
  }
  const link = `  <link rel="stylesheet" href="${cssHref}" data-marklog-package-stylesheet>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${link}\n</head>`);
  }
  return `${link}\n${html}`;
}

function networkInfo(serverInfo: { bindHost: string; port: number }, requestHost: string | undefined): NetworkInfo {
  const urls: NetworkUrl[] = [];
  const currentHost = requestHost?.trim();
  if (currentHost) {
    urls.push({
      label: "Current browser URL",
      address: currentHost,
      url: `http://${currentHost}`,
      kind: "current"
    });
  }

  urls.push({
    label: "This computer",
    address: `127.0.0.1:${serverInfo.port}`,
    url: `http://127.0.0.1:${serverInfo.port}`,
    kind: "loopback"
  });

  for (const address of localIpv4Addresses()) {
    urls.push({
      label: address.interfaceName,
      address: `${address.address}:${serverInfo.port}`,
      url: `http://${address.address}:${serverInfo.port}`,
      kind: "lan"
    });
  }

  const deduped = dedupeNetworkUrls(urls);
  return {
    bindHost: serverInfo.bindHost,
    port: serverInfo.port,
    lanAvailable: serverInfo.bindHost === "0.0.0.0" || serverInfo.bindHost === "::",
    urls: deduped
  };
}

function localIpv4Addresses(): Array<{ interfaceName: string; address: string }> {
  const interfaces = os.networkInterfaces();
  return Object.entries(interfaces).flatMap(([interfaceName, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => ({
        interfaceName,
        address: address.address
      }))
  );
}

function dedupeNetworkUrls(urls: NetworkUrl[]): NetworkUrl[] {
  const seen = new Set<string>();
  return urls.filter((entry) => {
    if (seen.has(entry.url)) {
      return false;
    }
    seen.add(entry.url);
    return true;
  });
}

function validateShareUrl(value: string): void {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError("QR URL must be http or https");
    }
  } catch {
    throw new ValidationError("Invalid QR URL");
  }
}

function normalizeDocumentRoutePath(input: string | undefined, fallbackTitle: string | undefined): string {
  const raw = (input?.trim() || fallbackTitle?.trim() || "untitled").replace(/\\/g, "/");
  const withoutHtml = raw.replace(/\/index\.html$/i, "").replace(/\.html$/i, "");
  const segments = withoutHtml
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ValidationError("Document route path cannot contain . or .. segments");
  }
  return segments.map(slugify).join("/") || "untitled";
}

function normalizePublicRoutePath(input: string): string {
  const decoded = safeDecodeURIComponent(input).replace(/\\/g, "/");
  const withoutQuery = decoded.split("?")[0]?.split("#")[0] ?? "";
  const withoutHtml = withoutQuery.replace(/\/index\.html$/i, "").replace(/\.html$/i, "");
  const segments = withoutHtml
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ValidationError("Invalid project page path");
  }
  return segments.map(slugify).join("/");
}

function wildcardParam(params: unknown): string {
  const wildcard = asBody(params)["*"];
  return typeof wildcard === "string" ? wildcard : "";
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ValidationError("Invalid encoded project page path");
  }
}

function buildAiIndexEntries(
  db: MarklogDb,
  projectId: string,
  pending?: {
    document: DocumentRecord;
    versionLabel: string;
    publishedAt: string;
    sourcePath: string;
    htmlPath: string;
    cssPath: string;
    manifestPath: string;
    packageIndexPath: string;
    mockPath: string;
    assetsPath: string;
  }
): AiIndexEntry[] {
  return db
    .listDocuments(projectId)
    .map((document) => {
      if (pending && document.id === pending.document.id) {
        return {
          title: document.title,
          documentId: document.id,
          routePath: document.routePath,
          status: "published",
          versionLabel: pending.versionLabel,
          publishedAt: pending.publishedAt,
          publicUrl: projectPageHref(projectId, document.routePath),
          sourcePath: pending.sourcePath,
          htmlPath: pending.htmlPath,
          cssPath: pending.cssPath,
          manifestPath: pending.manifestPath,
          packageIndexPath: pending.packageIndexPath,
          mockPath: pending.mockPath,
          assetsPath: pending.assetsPath
        } satisfies AiIndexEntry;
      }

      const revision = db.getLatestRevision(document.id);
      if (!revision) {
        return null;
      }
      const packagePaths = documentPackagePaths(document.routePath);

      return {
        title: document.title,
        documentId: document.id,
        routePath: document.routePath,
        status: document.status,
        versionLabel: revision.versionLabel,
        publishedAt: revision.createdAt,
        publicUrl: projectPageHref(projectId, document.routePath),
        sourcePath: revision.sourcePath,
        htmlPath: revision.htmlPath,
        cssPath: packagePaths.cssPath,
        manifestPath: packagePaths.manifestPath,
        packageIndexPath: packagePaths.packageIndexPath,
        mockPath: packagePaths.mockPath,
        assetsPath: packagePaths.assetsPath
      } satisfies AiIndexEntry;
    })
    .filter((entry): entry is AiIndexEntry => Boolean(entry));
}

type DocumentPackagePaths = {
  packagePath: string;
  htmlPath: string;
  cssPath: string;
  sourcePath: string;
  manifestPath: string;
  packageIndexPath: string;
  mockPath: string;
  assetsPath: string;
};

function documentPackagePaths(routePath: string): DocumentPackagePaths {
  return {
    packagePath: routePath,
    htmlPath: `${routePath}/index.html`,
    cssPath: `${routePath}/index.css`,
    sourcePath: `${routePath}/source.html`,
    manifestPath: `${routePath}/manifest.json`,
    packageIndexPath: `${routePath}/INDEX.md`,
    mockPath: `${routePath}/mock`,
    assetsPath: `${routePath}/assets`
  };
}

async function ensureDraftDocumentPackage(project: Project, document: DocumentRecord, createdAt: string): Promise<void> {
  const packagePaths = documentPackagePaths(document.routePath);
  const draftHtml = attachPackageStylesheet(
    preparePlanningHtml({
      title: document.title,
      html: document.currentDraft
    })
  );
  const manifest = {
    schema_version: 2,
    kind: "marklog.document.package",
    document_id: document.id,
    title: document.title,
    route_path: document.routePath,
    package_path: `${document.routePath}/`,
    entry: "index.html",
    ai_index: "INDEX.md",
    status: "draft",
    created_at: createdAt,
    public_url: projectPageHref(project.id, document.routePath),
    html_path: packagePaths.htmlPath,
    css_path: packagePaths.cssPath,
    package_index_path: packagePaths.packageIndexPath,
    mock_path: packagePaths.mockPath,
    assets_path: packagePaths.assetsPath,
    paths: {
      entry: packagePaths.htmlPath,
      stylesheet: packagePaths.cssPath,
      manifest: packagePaths.manifestPath,
      ai_index: packagePaths.packageIndexPath,
      mock: packagePaths.mockPath,
      assets: packagePaths.assetsPath
    },
    geo: geoMetadata(project, document, createdAt, "draft"),
    review: emptyReviewMetadata(),
    sections: extractPlanningSections(draftHtml),
    section_contract: planningSectionContract()
  };

  await writeRepoFile(project.repoPath, packagePaths.htmlPath, draftHtml);
  await writeRepoFile(project.repoPath, packagePaths.cssPath, packageCss());
  await writeRepoFile(project.repoPath, packagePaths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeRepoFile(project.repoPath, packagePaths.packageIndexPath, draftPackageIndex(project, document, packagePaths, createdAt));
  await writeRepoFile(project.repoPath, `${packagePaths.mockPath}/README.md`, mockReadme(document));
  await writeRepoFile(project.repoPath, `${packagePaths.assetsPath}/README.md`, assetsReadme(document));
}

function attachPackageStylesheet(html: string): string {
  if (html.includes("data-marklog-package-stylesheet")) {
    return html;
  }
  const link = '  <link rel="stylesheet" href="index.css" data-marklog-package-stylesheet>';
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${link}\n</head>`);
  }
  return `${link}\n${html}`;
}

function packageCss(): string {
  return `:root {
  --marklog-ink: #1c2430;
  --marklog-muted: #637083;
  --marklog-border: #d9dee5;
  --marklog-panel: #ffffff;
  --marklog-soft: #f8fafc;
  --marklog-accent: #235ba8;
}

[data-marklog-section] {
  scroll-margin-top: 24px;
}

[data-marklog-section] > h2,
[data-marklog-section] > h3 {
  color: var(--marklog-ink);
}

.marklog-placeholder {
  color: var(--marklog-muted);
}

.marklog-wireframe {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.marklog-wireframe div {
  min-height: 88px;
  border: 1px dashed #7d8da1;
  background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 10px, #eef2f6 10px, #eef2f6 20px);
  padding: 12px;
}

.marklog-mockup {
  display: grid;
  grid-template-columns: 180px 1fr 220px;
  min-height: 240px;
  border: 1px solid #94a3b8;
  background: #e2e8f0;
}

.marklog-mockup > * {
  padding: 14px;
  border-right: 1px solid #94a3b8;
  background: var(--marklog-soft);
}
`;
}

function draftPackageIndex(
  project: Project,
  document: DocumentRecord,
  packagePaths: DocumentPackagePaths,
  createdAt: string
): string {
  return `# Marklog Document Package: ${document.title}

## Package Metadata

- project_id: \`${project.id}\`
- document_id: \`${document.id}\`
- route_path: \`${document.routePath}/\`
- status: \`draft\`
- created_at: \`${createdAt}\`
- public_url: ${projectPageHref(project.id, document.routePath)}

## Package Contents

| Path | Purpose |
| --- | --- |
| \`${packagePaths.htmlPath}\` | Draft viewer HTML entrypoint |
| \`${packagePaths.cssPath}\` | Package stylesheet |
| \`${packagePaths.manifestPath}\` | Draft package manifest |
| \`${packagePaths.packageIndexPath}\` | AI-readable package index |
| \`${packagePaths.mockPath}/\` | Mockup and wireframe assets |
| \`${packagePaths.assetsPath}/\` | Images and supporting assets |

This draft package is materialized before publish. The first publish will commit the package as a revision.
`;
}

function mockReadme(document: DocumentRecord): string {
  return `# Mock Assets: ${document.title}

Store low-fidelity mockups, wireframes, interaction states, and exported design references for this document package.
`;
}

function assetsReadme(document: DocumentRecord): string {
  return `# Document Assets: ${document.title}

Store images and supporting files referenced by \`index.html\` for this document package.
`;
}

async function syncAiFolderIndexes(repoPath: string, files: AiFolderIndexFile[]): Promise<string[]> {
  const existingGeneratedPaths = await findGeneratedAiIndexPaths(repoPath);
  const currentPaths = new Set(files.map((file) => file.relativePath));
  const removedPaths = existingGeneratedPaths.filter((relativePath) => !currentPaths.has(relativePath));

  await Promise.all(files.map((file) => writeRepoFile(repoPath, file.relativePath, file.contents)));
  await Promise.all(
    removedPaths.map((relativePath) =>
      fs.rm(ensureInside(repoPath, path.join(repoPath, ...relativePath.split("/"))), { force: true })
    )
  );

  return [...new Set([...currentPaths, ...removedPaths])];
}

async function findGeneratedAiIndexPaths(repoPath: string, directory = repoPath): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === ".git") {
        return [];
      }
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findGeneratedAiIndexPaths(repoPath, absolutePath);
      }
      if (!entry.isFile() || entry.name !== "INDEX.md") {
        return [];
      }
      const contents = await fs.readFile(absolutePath, "utf8");
      if (!isGeneratedAiFolderIndex(contents)) {
        return [];
      }
      return [path.relative(repoPath, absolutePath).split(path.sep).join("/")];
    })
  );
  return paths.flat();
}

function projectPageHref(projectId: string, routePath: string): string {
  return `/projects/${encodeURIComponent(projectId)}/${routePath.split("/").map(encodeURIComponent).join("/")}`;
}

function geoMetadata(
  project: Project,
  document: DocumentRecord,
  timestamp: string,
  confidence: "draft" | "reviewed" | "accepted"
) {
  const routeKeywords = document.routePath.split("/").filter(Boolean);
  const titleKeywords = document.title
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const keywords = uniqueStrings([
    ...titleKeywords,
    ...routeKeywords,
    "planning document",
    "html document package",
    "marklog"
  ]);

  return {
    summary: `${document.title} is a Marklog HTML document package for ${project.name}. It is optimized for humans to review and AI agents to read, quote, and reuse.`,
    audience: ["product", "design", "engineering", "qa", "leadership", "ai-agent"],
    keywords,
    entities: uniqueStrings([project.name, document.title, "Marklog", "HTML document package"]),
    canonical_url: projectPageHref(project.id, document.routePath),
    last_verified_at: timestamp,
    confidence,
    read_first_sections: ["answer-summary", "source-of-truth", "summary", "requirements", "open-questions"],
    citation_anchors: {
      answer_summary: `${projectPageHref(project.id, document.routePath)}#answer-summary`,
      source_of_truth: `${projectPageHref(project.id, document.routePath)}#source-of-truth`,
      requirements: `${projectPageHref(project.id, document.routePath)}#requirements`
    }
  };
}

function emptyReviewMetadata() {
  return {
    comment_count: 0,
    open_comment_count: 0,
    reviewed_sections: [] as string[],
    needs_revision: false
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function packagePathFromRevision(revision: Revision): string {
  return revision.htmlPath.replace(/\/index\.html$/i, "");
}

function resolvePackageAssetRequest(
  db: MarklogDb,
  projectId: string,
  input: string
): { document: DocumentRecord; assetPath: string } | null {
  const segments = publicPathSegments(input);
  for (let index = segments.length - 1; index >= 1; index -= 1) {
    const routePath = segments.slice(0, index).join("/");
    const assetPath = segments.slice(index).join("/");
    if (!isAllowedPackageAsset(assetPath)) {
      continue;
    }
    const document = db.getDocumentByProjectRoutePath(projectId, routePath);
    if (document) {
      return { document, assetPath };
    }
  }
  return null;
}

function publicPathSegments(input: string): string[] {
  const decoded = safeDecodeURIComponent(input).replace(/\\/g, "/");
  const withoutQuery = decoded.split("?")[0]?.split("#")[0] ?? "";
  const segments = withoutQuery
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ValidationError("Invalid project package path");
  }
  return segments;
}

function isAllowedPackageAsset(assetPath: string): boolean {
  return (
    assetPath === "index.css" ||
    assetPath === "manifest.json" ||
    assetPath === "source.html" ||
    assetPath === "INDEX.md" ||
    assetPath.startsWith("mock/") ||
    assetPath.startsWith("assets/")
  );
}

function contentTypeForAsset(assetPath: string): string {
  if (assetPath.endsWith(".css")) return "text/css; charset=utf-8";
  if (assetPath.endsWith(".json")) return "application/json; charset=utf-8";
  if (assetPath.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (assetPath.endsWith(".html")) return "text/html; charset=utf-8";
  if (assetPath.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (assetPath.endsWith(".png")) return "image/png";
  if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) return "image/jpeg";
  if (assetPath.endsWith(".webp")) return "image/webp";
  return "text/plain; charset=utf-8";
}

async function writeRepoFile(repoPath: string, relativePath: string, contents: string): Promise<void> {
  const target = ensureInside(repoPath, path.join(repoPath, ...relativePath.split("/")));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, "utf8");
}

async function readRevisionFile(repoPath: string, revision: Revision, kind: "source" | "html"): Promise<string> {
  const relativePath = kind === "source" ? revision.sourcePath : revision.htmlPath;
  return readRevisionPath(repoPath, revision, relativePath);
}

async function readRevisionPath(repoPath: string, revision: Revision, relativePath: string): Promise<string> {
  const git = gitFor(repoPath);
  try {
    return await git.raw(["show", `${revision.commitHash}:${relativePath}`]);
  } catch {
    throw new NotFoundError("Revision file not found");
  }
}

async function readRevisionAsset(
  repoPath: string,
  revision: Revision,
  relativePath: string,
  assetPath: string
): Promise<string> {
  try {
    return await readRevisionPath(repoPath, revision, relativePath);
  } catch (error) {
    if (error instanceof NotFoundError && assetPath === "index.css") {
      return packageCss();
    }
    throw error;
  }
}

async function hasHead(git: ReturnType<typeof gitFor>): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function hasStagedChanges(git: ReturnType<typeof gitFor>): Promise<boolean> {
  const status = await git.status();
  return status.staged.length > 0 || status.created.length > 0 || status.deleted.length > 0 || status.renamed.length > 0;
}

async function rollbackRepoPaths(repoPath: string, relativePaths: string[], hadHead: boolean): Promise<void> {
  const uniquePaths = [...new Set(relativePaths)];
  const git = gitFor(repoPath);
  try {
    await git.raw(["reset", "--", ...uniquePaths]);
    if (hadHead) {
      await git.raw(["checkout", "--", ...uniquePaths]);
    } else {
      await Promise.all(
        uniquePaths.map((relativePath) =>
          fs.rm(ensureInside(repoPath, path.join(repoPath, ...relativePath.split("/"))), {
            recursive: true,
            force: true
          })
        )
      );
    }
  } catch {
    // The original git error is more useful to the caller than rollback noise.
  }
}

function splitDiffLines(value: string): string[] {
  const lines = value.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function acceptsHtml(acceptHeader: string | undefined): boolean {
  return !acceptHeader || acceptHeader.includes("text/html") || acceptHeader.includes("*/*");
}

function now(): string {
  return new Date().toISOString();
}

function asBody(value: unknown): BodyRecord {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as BodyRecord;
}

function param(params: unknown, key: string): string {
  return requiredString(asBody(params), key);
}

function requiredString(body: BodyRecord, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${key} is required`);
  }
  return value.trim();
}

function boundedString(value: string, key: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${key} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${key} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

function optionalString(body: BodyRecord, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }
  return value;
}

function optionalBoundedString(body: BodyRecord, key: string, maxLength: number): string | null {
  const value = optionalString(body, key)?.trim();
  if (!value) {
    return null;
  }
  return boundedString(value, key, maxLength);
}

function optionalInteger(body: BodyRecord, key: string, maxValue: number): number | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maxValue) {
    throw new ValidationError(`${key} must be an integer from 0 to ${maxValue}`);
  }
  return value;
}

function commentAnchorFromBody(body: BodyRecord): ViewerCommentAnchor {
  const anchor = asBody(body.anchor);
  return {
    sectionId: optionalBoundedString(anchor, "sectionId", 160) ?? optionalBoundedString(body, "sectionId", 160),
    cssSelector: optionalBoundedString(anchor, "cssSelector", 700),
    startOffset: optionalInteger(anchor, "startOffset", 1_000_000),
    endOffset: optionalInteger(anchor, "endOffset", 1_000_000),
    textBefore: optionalBoundedString(anchor, "textBefore", 500),
    textAfter: optionalBoundedString(anchor, "textAfter", 500)
  };
}

function optionalStatus(body: BodyRecord, key: string): DocumentStatus | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  throw new ValidationError(`${key} must be draft, published, or archived`);
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
