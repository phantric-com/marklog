import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { createApp } from "../src/server/app.js";
import type {
  CommentExportResponse,
  DiffResponse,
  DocumentRecord,
  GitPushResponse,
  Project,
  PublishResponse,
  ReindexResponse,
  Revision,
  RevisionDetail,
  ViewerComment,
  WorkspaceStatus
} from "../src/shared/types.js";

const execFileAsync = promisify(execFile);

describe("Marklog API", () => {
  let rootDir: string;
  let workspacePath: string;
  let configDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "marklog-api-"));
    workspacePath = path.join(rootDir, "workspace");
    configDir = path.join(rootDir, "config");
    app = await createApp({ configDir, devServer: false, staticDir: null });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("runs the MVP document publishing flow", async () => {
    const statusBefore = await injectJson<WorkspaceStatus>("GET", "/api/workspace/status");
    expect(statusBefore.initialized).toBe(false);
    expect(statusBefore.git.available).toBe(true);

    const networkInfo = await injectJson<{ urls: Array<{ url: string; kind: string }> }>("GET", "/api/network/urls");
    expect(networkInfo.urls.some((entry) => entry.kind === "loopback" && entry.url.includes("127.0.0.1"))).toBe(true);

    const qrResponse = await app.inject({
      method: "GET",
      url: "/api/qr.svg?url=http%3A%2F%2F127.0.0.1%3A3333%2F"
    });
    expect(qrResponse.statusCode).toBe(200);
    expect(qrResponse.headers["content-type"]).toContain("image/svg+xml");
    expect(qrResponse.payload).toContain("<svg");

    const statusAfter = await injectJson<WorkspaceStatus>("POST", "/api/workspace/init", {
      path: workspacePath
    });
    expect(statusAfter.initialized).toBe(true);
    expect(statusAfter.workspacePath).toBe(workspacePath);

    const project = await injectJson<Project>("POST", "/api/projects", {
      name: "Launch Plan",
      description: "Go-to-market planning"
    });
    expect(project.name).toBe("Launch Plan");
    await expect(fs.stat(path.join(workspacePath, "repositories", project.id, ".git"))).resolves.toBeTruthy();

    const document = await injectJson<DocumentRecord>("POST", `/api/projects/${project.id}/documents`, {
      title: "Pricing Strategy",
      routePath: "strategy/pricing"
    });
    expect(document.status).toBe("draft");
    expect(document.routePath).toBe("strategy/pricing");
    const packageRoot = path.join(workspacePath, "repositories", project.id, "strategy", "pricing");
    await expect(fs.readFile(path.join(packageRoot, "index.html"), "utf8")).resolves.toContain("Pricing Strategy");
    await expect(fs.readFile(path.join(packageRoot, "index.css"), "utf8")).resolves.toContain("--marklog-ink");
    await expect(fs.readFile(path.join(packageRoot, "manifest.json"), "utf8")).resolves.toContain('"status": "draft"');
    const draftManifest = JSON.parse(await fs.readFile(path.join(packageRoot, "manifest.json"), "utf8")) as {
      schema_version: number;
      entry: string;
      ai_index: string;
      geo: { confidence: string; canonical_url: string; read_first_sections: string[] };
      sections: Array<{ id: string; href: string; geo: string | null; required: boolean }>;
    };
    expect(draftManifest.schema_version).toBe(2);
    expect(draftManifest.entry).toBe("index.html");
    expect(draftManifest.ai_index).toBe("INDEX.md");
    expect(draftManifest.geo.confidence).toBe("draft");
    expect(draftManifest.geo.canonical_url).toBe(`/projects/${project.id}/strategy/pricing`);
    expect(draftManifest.geo.read_first_sections).toContain("answer-summary");
    expect(
      draftManifest.sections.some(
        (section) => section.id === "answer-summary" && section.href === "#answer-summary" && section.geo === "answer-summary"
      )
    ).toBe(true);
    expect(draftManifest.sections.some((section) => section.id === "wireframe" && section.href === "#wireframe")).toBe(
      true
    );
    await expect(fs.readFile(path.join(packageRoot, "INDEX.md"), "utf8")).resolves.toContain("status: `draft`");
    await expect(fs.readFile(path.join(packageRoot, "mock", "README.md"), "utf8")).resolves.toContain("Mock Assets");
    await expect(fs.readFile(path.join(packageRoot, "assets", "README.md"), "utf8")).resolves.toContain("Document Assets");

    const firstDraft = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pricing Strategy</title>
</head>
<body>
  <main>
    <h1>Pricing Strategy</h1>
    <ul>
      <li>Basic</li>
      <li>Pro</li>
    </ul>
  </main>
</body>
</html>`;
    await injectJson<DocumentRecord>("PATCH", `/api/documents/${document.id}`, {
      currentDraft: firstDraft
    });

    const preview = await injectJson<{ html: string }>("POST", `/api/documents/${document.id}/preview`, {
      source: firstDraft
    });
    expect(preview.html).toContain("<title>Pricing Strategy</title>");
    expect(preview.html).toContain("<li>Basic</li>");
    expect(preview.html).toContain('id="section-index"');
    expect(preview.html).toContain('href="#answer-summary"');
    expect(preview.html).toContain('id="answer-summary"');
    expect(preview.html).toContain('data-marklog-geo="source-of-truth"');
    expect(preview.html).toContain('href="#wireframe"');
    expect(preview.html).toContain('id="summary"');
    expect(preview.html).toContain('data-marklog-section="ai-notes"');

    const firstPublish = await injectJson<PublishResponse>("POST", `/api/documents/${document.id}/publish`, {
      source: firstDraft,
      message: "Initial publish"
    });
    expect(firstPublish.revision.versionLabel).toBe("v1");
    expect(firstPublish.revision.commitHash).toHaveLength(40);

    const firstComment = await injectJson<ViewerComment>("POST", `/api/revisions/${firstPublish.revision.id}/comments`, {
      authorName: "Reviewer",
      selectedText: "Basic",
      anchor: {
        sectionId: "summary",
        cssSelector: "#summary",
        startOffset: 0,
        endOffset: 5,
        textBefore: null,
        textAfter: "Pro"
      },
      note: "Clarify whether Basic is a free tier."
    });
    expect(firstComment.revisionId).toBe(firstPublish.revision.id);
    expect(firstComment.selectedText).toBe("Basic");
    expect(firstComment.anchor.sectionId).toBe("summary");
    expect(firstComment.anchor.cssSelector).toBe("#summary");

    const firstRevisionComments = await injectJson<ViewerComment[]>(
      "GET",
      `/api/revisions/${firstPublish.revision.id}/comments`
    );
    expect(firstRevisionComments).toHaveLength(1);
    expect(firstRevisionComments[0]?.note).toContain("free tier");

    const sourcePath = path.join(
      workspacePath,
      "repositories",
      project.id,
      "documents",
      document.id,
      "source.html"
    );
    const htmlPath = path.join(packageRoot, "index.html");
    const routeSourcePath = path.join(packageRoot, "source.html");
    await expect(fs.readFile(routeSourcePath, "utf8")).resolves.toBe(firstDraft);
    await expect(fs.stat(sourcePath)).rejects.toThrow();
    await expect(fs.readFile(htmlPath, "utf8")).resolves.toContain("Pricing Strategy");
    await expect(fs.readFile(htmlPath, "utf8")).resolves.toContain('id="section-index"');
    await expect(fs.readFile(htmlPath, "utf8")).resolves.toContain('id="source-of-truth"');
    await expect(fs.readFile(htmlPath, "utf8")).resolves.toContain('id="wireframe"');
    await expect(fs.readFile(path.join(packageRoot, "index.css"), "utf8")).resolves.toContain(".marklog-wireframe");
    await expect(fs.readFile(path.join(packageRoot, "manifest.json"), "utf8")).resolves.toContain('"package_path": "strategy/pricing/"');
    const publishedManifest = JSON.parse(await fs.readFile(path.join(packageRoot, "manifest.json"), "utf8")) as {
      kind: string;
      status: string;
      paths: { entry: string; source: string; ai_index: string };
      geo: { confidence: string; citation_anchors: { answer_summary: string; source_of_truth: string } };
      review: { comment_count: number; needs_revision: boolean };
      section_contract: Array<{ id: string; href: string; geo: string | null }>;
      sections: Array<{ id: string; title: string; order: number; geo: string | null }>;
    };
    expect(publishedManifest.kind).toBe("marklog.document.package");
    expect(publishedManifest.status).toBe("published");
    expect(publishedManifest.paths.entry).toBe("strategy/pricing/index.html");
    expect(publishedManifest.paths.source).toBe("strategy/pricing/source.html");
    expect(publishedManifest.geo.confidence).toBe("reviewed");
    expect(publishedManifest.geo.citation_anchors.answer_summary).toBe(`/projects/${project.id}/strategy/pricing#answer-summary`);
    expect(publishedManifest.review.needs_revision).toBe(false);
    expect(publishedManifest.section_contract.some((section) => section.id === "requirements")).toBe(true);
    expect(publishedManifest.section_contract.some((section) => section.id === "source-of-truth" && section.geo === "source-of-truth")).toBe(true);
    expect(publishedManifest.sections.some((section) => section.id === "answer-summary" && section.geo === "answer-summary")).toBe(true);
    expect(publishedManifest.sections.some((section) => section.id === "summary" && section.order > 0)).toBe(true);
    await expect(fs.readFile(path.join(workspacePath, "repositories", project.id, "INDEX.md"), "utf8")).resolves.toContain(
      "marklog:generated-folder-index"
    );
    await expect(fs.readFile(path.join(workspacePath, "repositories", project.id, "INDEX.md"), "utf8")).resolves.toContain(
      "## This Folder Answers"
    );
    await expect(fs.readFile(path.join(workspacePath, "repositories", project.id, "llms.txt"), "utf8")).resolves.toContain(
      "index.html#answer-summary"
    );
    await expect(
      fs.readFile(path.join(workspacePath, "repositories", project.id, "strategy", "INDEX.md"), "utf8")
    ).resolves.toContain("Pricing Strategy");
    await expect(fs.readFile(path.join(packageRoot, "INDEX.md"), "utf8")).resolves.toContain("This folder is a Marklog document package.");
    await expect(fs.readFile(path.join(packageRoot, "INDEX.md"), "utf8")).resolves.toContain("### GEO Entry Points");
    await expect(fs.readFile(path.join(packageRoot, "INDEX.md"), "utf8")).resolves.toContain("index.css");

    const commentExport = await injectJson<CommentExportResponse>(
      "POST",
      `/api/revisions/${firstPublish.revision.id}/comments/export`,
      { commit: true }
    );
    expect(commentExport.commentCount).toBe(1);
    expect(commentExport.path).toBe(`.marklog/comments/${firstPublish.revision.id}.jsonl`);
    expect(commentExport.jsonl).toContain('"anchor"');
    expect(commentExport.committed).toBe(true);
    await expect(fs.readFile(path.join(workspacePath, "repositories", project.id, commentExport.path), "utf8")).resolves.toContain(
      "Clarify whether Basic is a free tier."
    );

    const secondDraft = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pricing Strategy</title>
</head>
<body>
  <main>
    <h1>Pricing Strategy</h1>
    <ul>
      <li>Basic</li>
      <li>Pro</li>
      <li>Enterprise</li>
    </ul>
  </main>
</body>
</html>`;
    const secondPublish = await injectJson<PublishResponse>("POST", `/api/documents/${document.id}/publish`, {
      source: secondDraft,
      message: "Add enterprise tier"
    });
    expect(secondPublish.revision.versionLabel).toBe("v2");
    await expect(
      fs.readFile(path.join(workspacePath, "repositories", project.id, "strategy", "INDEX.md"), "utf8")
    ).resolves.toContain("v2");

    const reindex = await injectJson<ReindexResponse>("POST", `/api/projects/${project.id}/reindex`, { commit: true });
    expect(reindex.projectId).toBe(project.id);
    expect(reindex.indexPaths).toContain("llms.txt");
    expect(reindex.indexPaths).toContain("INDEX.md");

    const revisions = await injectJson<Revision[]>("GET", `/api/documents/${document.id}/revisions`);
    expect(revisions.map((revision) => revision.versionLabel)).toEqual(["v2", "v1"]);

    const remotePath = path.join(rootDir, "remote.git");
    const projectRepoPath = path.join(workspacePath, "repositories", project.id);
    await execFileAsync("git", ["init", "--bare", remotePath]);
    await execFileAsync("git", ["-C", projectRepoPath, "remote", "add", "origin", remotePath]);
    const currentBranch = (await execFileAsync("git", ["-C", projectRepoPath, "branch", "--show-current"])).stdout.trim();
    const pushResult = await injectJson<GitPushResponse>("POST", `/api/projects/${project.id}/push`, {
      remote: "origin",
      branch: currentBranch
    });
    expect(pushResult.pushed).toBe(true);
    expect(pushResult.remote).toBe("origin");
    expect(pushResult.branch).toBe(currentBranch);
    const pushedHead = (await execFileAsync("git", ["--git-dir", remotePath, "rev-parse", currentBranch])).stdout.trim();
    expect(pushedHead).toBe(reindex.commitHash ?? secondPublish.revision.commitHash);

    const secondRevisionComments = await injectJson<ViewerComment[]>(
      "GET",
      `/api/revisions/${secondPublish.revision.id}/comments`
    );
    expect(secondRevisionComments).toHaveLength(0);

    const detail = await injectJson<RevisionDetail>("GET", `/api/revisions/${firstPublish.revision.id}`);
    expect(detail.source).toBe(firstDraft);
    expect(detail.html).toContain("<li>Pro</li>");

    const diff = await injectJson<DiffResponse>("POST", "/api/revisions/diff", {
      baseRevisionId: firstPublish.revision.id,
      targetRevisionId: secondPublish.revision.id
    });
    expect(diff.blocks.some((block) => block.type === "added" && block.lines.includes("      <li>Enterprise</li>"))).toBe(
      true
    );

    const restored = await injectJson<DocumentRecord>("POST", `/api/revisions/${firstPublish.revision.id}/restore`);
    expect(restored.status).toBe("draft");
    expect(restored.currentDraft).toBe(firstDraft);

    const htmlResponse = await app.inject({
      method: "GET",
      url: `/api/revisions/${secondPublish.revision.id}/html`
    });
    expect(htmlResponse.statusCode).toBe(200);
    expect(htmlResponse.headers["content-type"]).toContain("text/html");
    expect(htmlResponse.payload).toContain("Enterprise");
    expect(htmlResponse.payload).toContain("marklog-viewer-context");
    expect(htmlResponse.payload).toContain("marklog-comment-highlight");
    expect(htmlResponse.payload).toContain("selectionAnchor");
    expect(htmlResponse.payload).toContain(`/api/revisions/${secondPublish.revision.id}/comments`);

    const downloadHtmlResponse = await app.inject({
      method: "GET",
      url: `/api/revisions/${secondPublish.revision.id}/html?download=1`
    });
    expect(downloadHtmlResponse.statusCode).toBe(200);
    expect(downloadHtmlResponse.payload).toContain("Enterprise");
    expect(downloadHtmlResponse.payload).not.toContain("marklog-viewer-context");

    const latestPageResponse = await app.inject({
      method: "GET",
      url: `/p/${document.id}`
    });
    expect(latestPageResponse.statusCode).toBe(200);
    expect(latestPageResponse.headers["content-type"]).toContain("text/html");
    expect(latestPageResponse.payload).toContain("Enterprise");
    expect(latestPageResponse.payload).toContain("Comments");

    const versionPageResponse = await app.inject({
      method: "GET",
      url: `/p/${document.id}/v1`
    });
    expect(versionPageResponse.statusCode).toBe(200);
    expect(versionPageResponse.payload).toContain("Basic");
    expect(versionPageResponse.payload).not.toContain("Enterprise");
    expect(versionPageResponse.payload).toContain(`/api/revisions/${firstPublish.revision.id}/comments`);

    const numericVersionPageResponse = await app.inject({
      method: "GET",
      url: `/p/${document.id}/1`
    });
    expect(numericVersionPageResponse.statusCode).toBe(200);
    expect(numericVersionPageResponse.payload).not.toContain("Enterprise");

    const revisionIdPageResponse = await app.inject({
      method: "GET",
      url: `/p/${document.id}/${secondPublish.revision.id}`
    });
    expect(revisionIdPageResponse.statusCode).toBe(200);
    expect(revisionIdPageResponse.payload).toContain("Enterprise");

    const projectRootResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/`
    });
    expect(projectRootResponse.statusCode).toBe(302);
    expect(projectRootResponse.headers.location).toBe(`/projects/${project.id}`);

    const latestProjectPageResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing`
    });
    expect(latestProjectPageResponse.statusCode).toBe(200);
    expect(latestProjectPageResponse.payload).toContain("Enterprise");
    expect(latestProjectPageResponse.payload).toContain("data-marklog-package-stylesheet");
    expect(latestProjectPageResponse.payload).toContain(`/projects/${project.id}/strategy/pricing/index.css?revision=v2`);

    const latestProjectFolderPageResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing/`
    });
    expect(latestProjectFolderPageResponse.statusCode).toBe(200);
    expect(latestProjectFolderPageResponse.payload).toContain("Enterprise");

    const packageCssResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing/index.css?revision=v1`
    });
    expect(packageCssResponse.statusCode).toBe(200);
    expect(packageCssResponse.headers["content-type"]).toContain("text/css");
    expect(packageCssResponse.payload).toContain("--marklog-ink");

    const packageIndexResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing/INDEX.md?revision=v1`
    });
    expect(packageIndexResponse.statusCode).toBe(200);
    expect(packageIndexResponse.payload).toContain("Document Package");

    const latestHtmlSuffixResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing.html`
    });
    expect(latestHtmlSuffixResponse.statusCode).toBe(200);
    expect(latestHtmlSuffixResponse.payload).toContain("Enterprise");

    const fixedRevisionProjectPageResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/strategy/pricing?revision=v1`
    });
    expect(fixedRevisionProjectPageResponse.statusCode).toBe(200);
    expect(fixedRevisionProjectPageResponse.payload).toContain("Basic");
    expect(fixedRevisionProjectPageResponse.payload).not.toContain("Enterprise");
    expect(fixedRevisionProjectPageResponse.payload).toContain(`/projects/${project.id}/strategy/pricing/index.css?revision=v1`);

    const resetResponse = await app.inject({
      method: "POST",
      url: "/api/workspace/reset",
      payload: JSON.stringify({ confirm: true }),
      headers: { "content-type": "application/json" }
    });
    expect(resetResponse.statusCode).toBe(404);
  });

  async function injectJson<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await app.inject({
      method,
      url,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { "content-type": "application/json" }
    });
    expect(response.statusCode, response.payload).toBeGreaterThanOrEqual(200);
    expect(response.statusCode, response.payload).toBeLessThan(300);
    return response.json() as T;
  }
});
