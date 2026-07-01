# AGENTS.md

## Project Overview

Marklog Local is a local-only planning document archive server. Humans use the browser UI to view and comment on published planning document packages. AI agents use the API to create projects/documents, write AI-produced HTML, publish revisions, commit them to project-local Git repositories, and push those repositories when a remote is configured.

The app is distributed as source code, not as a hosted service. Sharing Marklog means pushing this repository to GitHub so other people can clone or pull it and run the local server on their own machine.

This repository is a single TypeScript package:

- `src/server`: Fastify API, SQLite persistence, Git integration, HTML normalization, AI folder indexes
- `src/client`: React UI served by Vite in development and by Fastify in production
- `src/shared`: types shared by the server and client
- `tests`: API integration tests using Fastify `inject`

The app is designed to bind only to localhost by default and not call external services during normal use.

## Commands

Use `pnpm`.

```sh
pnpm install
pnpm dev
pnpm dev:lan
pnpm typecheck
pnpm test
pnpm build
pnpm start
pnpm start:lan
```

Command behavior:

- `pnpm dev`: starts the Fastify server with Vite middleware at `http://127.0.0.1:3333`.
- `pnpm dev:lan`: starts the development server bound to `0.0.0.0` for same-Wi-Fi access.
- `pnpm build`: removes `dist`, compiles the server, and builds the React app.
- `pnpm start`: runs the production server from `dist/server/index.js`.
- `pnpm start:lan`: runs the production server bound to `0.0.0.0` for same-Wi-Fi access.
- `pnpm test`: runs the API integration suite.
- `pnpm typecheck`: checks client, shared, server, and test TypeScript.
- `pnpm marklog -- <command>`: runs the AI-facing CLI against `MARKLOG_SERVER` or `http://127.0.0.1:3333`.

If `pnpm install` reports ignored `esbuild` builds, keep `pnpm-workspace.yaml` configured with:

```yaml
allowBuilds:
  esbuild: true
```

Then run:

```sh
pnpm rebuild esbuild
```

## Source Sharing Model

- Keep this repository as the source distribution unit.
- Do not add deployment-specific assumptions, hosted-backend requirements, account systems, or cloud storage to the core workflow.
- `private: true` in `package.json` is intentional; this is not meant to be published to npm.
- `dist/`, `node_modules/`, app config, and workspaces stay out of Git.
- A new user should be able to clone, run `pnpm install`, run `pnpm dev`, initialize a workspace, and start using Marklog locally.
- `publish` inside the API means creating a local Git commit in the configured Marklog workspace, not deploying to a server.
- Git push is AI-operated through `POST /api/projects/:projectId/push` and succeeds only when the project repo already has a remote configured.
- Existing local data compatibility is not guaranteed during early MVP schema changes. Prefer clean schema changes over compatibility migrations unless the user explicitly asks to preserve data.

## Local App Usage

1. Start the app with `pnpm dev` or build and run with `pnpm build && pnpm start`.
2. Open `http://127.0.0.1:3333` for the dashboard.
3. Initialize a workspace. The default suggestion is `~/Marklog Workspace`.
4. Open `http://127.0.0.1:3333/projects` to browse projects already created by AI.
5. Open `http://127.0.0.1:3333/projects/{projectId}` for the project viewer.
6. Use the left-side document tree to navigate user-facing document package folders. It must show document folders, not internal package files such as generated `INDEX.md`, `source.html`, `manifest.json`, `index.css`, `mock/`, or `assets/`.
7. Use the right-side History panel to switch between latest and fixed revisions, and use Compare Revisions for line-based unified or side-by-side diffs.
8. In the center viewer, read the document and drag over text to write comments. Comments are saved per revision, so `/projects/{projectId}/{path}` and `/projects/{projectId}/{path}?revision=v1` can have different comment lists.
9. Link directly to sections with URL fragments such as `/projects/{projectId}/{path}#wireframe` or `/projects/{projectId}/{path}?revision=v1#decision-log`.
10. Use Settings > Interface to switch light/dark theme and Korean/English UI labels. This only changes the Marklog shell UI, not committed document package content.

Humans should not need project/document creation, HTML editing, publish, restore, download, commit, or push controls in the browser UI. Keep those capabilities available to AI agents through API routes.

## AI Workflow

Use the CLI/API for all content-changing work:

1. Start the server with `pnpm dev`, `pnpm start`, `pnpm dev:lan`, or `pnpm start:lan`.
2. Create or locate a project with `pnpm marklog -- create-project --name <name>` or `pnpm marklog -- list-projects`.
3. Generate semantic HTML outside the browser UI.
4. Create a document package with `pnpm marklog -- create-doc --project <id> --title <title> --path <route> --source-file <html>`.
5. Publish with `pnpm marklog -- publish-doc --project <id> --path <route> --source-file <html> --message <text>`.
6. Reindex generated AI navigation files with `pnpm marklog -- reindex --project <id> --commit` when structure metadata needs refresh.
7. Export review comments with `pnpm marklog -- export-comments --revision <revisionId> --commit --output comments.jsonl` when reviewer feedback should enter the project repository.
8. Push only after the project repository has a configured remote: `pnpm marklog -- push --project <id> --remote origin --branch <branch>`.

Do not add browser buttons that duplicate these AI workflow steps unless the product direction changes explicitly.

For same-Wi-Fi sharing, run `pnpm start:lan` after `pnpm build` or use `pnpm dev:lan` during development. The Settings screen shows LAN URLs, and the top bar plus published-page actions provide QR codes for fast phone/tablet access.

Direct published-page URLs:

- `/p/{documentId}`: opens the latest published revision for a document.
- `/p/{documentId}/{revisionRef}`: opens a specific revision. `revisionRef` can be `v2`, `2`, a revision id, or a commit hash prefix.
- `/projects/{projectId}`: opens the project viewer UI.
- `/projects/{projectId}/{folder/path}`: opens the latest published HTML for the document whose `routePath` matches that tree path.
- `/projects/{projectId}/{folder/path}?revision=v2`: opens a specific revision for that tree path.
- `/projects/{projectId}/{folder/path}/index.css?revision=v2`: opens the package stylesheet for that revision.
- `/projects/{projectId}/{folder/path}/INDEX.md?revision=v2`: opens the AI package index for that revision.
- `/projects/{projectId}/{folder/path}/mock/...` and `/projects/{projectId}/{folder/path}/assets/...`: open committed package assets for the selected revision.

`{folder/path}.html` and `{folder/path}/index.html` are normalized to the same document route path.

Published viewer pages get a server-injected comment layer. The committed package `index.html` remains the archived planning document entrypoint, while the live response adds the Marklog comment panel. HTML downloads use the committed HTML without the viewer layer.

Each document package `manifest.json` is the machine-readable contract for the package. It must include `schema_version`, `kind`, `entry`, `ai_index`, `paths`, `geo`, `review`, `sections`, and `section_contract` alongside the legacy path fields. AI agents should read `manifest.json` before walking package files directly.

Published HTML is normalized with a Marklog planning structure contract:

- The rendered document gets a `#section-index` table of contents.
- Required section anchors are `#answer-summary`, `#source-of-truth`, `#summary`, `#target-reader`, `#context`, `#goals`, `#decision-log`, `#user-flow`, `#wireframe`, `#mockup`, `#requirements`, `#open-questions`, and `#ai-notes`.
- GEO sections use `data-marklog-geo`; keep `#answer-summary` concise and `#source-of-truth` focused on stable facts, decisions, and rules that AI agents should preserve.
- Existing `<section>` and heading elements receive stable ids when missing.
- Missing required planning sections are appended with `data-marklog-required="true"` placeholders.
- Use semantic `<main>`, `<article>`, `<section>`, `<header>`, `<aside>`, `<nav>`, tables, and lists so humans, browsers, and AI agents can navigate consistently.

The workspace stores:

```text
app.sqlite
repositories/
  {projectId}/
    .git/
    .marklog/
      comments/
    llms.txt
    INDEX.md
    {route-folder}/
      INDEX.md
      {route-leaf}/
        INDEX.md
        source.html
        manifest.json
        index.css
        index.html
        mock/
          README.md
        assets/
          README.md
```

Draft content lives in SQLite. A draft document package is materialized in the project repository when the document is created, but Git commits are created only when a document is published.

Viewer comments live in SQLite and are keyed by `revision_id`; they are not written into committed HTML files.

Viewer comments store an `anchor` JSON object, not just plain selected text. The anchor includes `sectionId`, `cssSelector`, `startOffset`, `endOffset`, `textBefore`, and `textAfter`. If an older `viewer_comments` table lacks `anchor_json`, the server drops that table instead of migrating old comment rows.

Generated `INDEX.md` files are AI-oriented folder/package indexes. They are written at the project repo root, routePath parent folders, and each document package folder whenever a document is published. They include stable package paths, latest version labels, published timestamps, public HTML URLs, package content paths, and GEO reading guidance. They are internal AI navigation files and should not appear as individual files in the visible app tree.

Generated `llms.txt` is written at each project repository root on publish/reindex. It is the first-read file for AI agents and summarizes read order, important rules, canonical package manifests, and GEO citation anchors.

## Implementation Notes

- SQLite uses Node's built-in `node:sqlite` `DatabaseSync`; do not add native SQLite packages unless there is a clear reason.
- Project repositories use the local Git CLI through `simple-git`.
- The server sets a local Git identity in each project repo before commits.
- Documents have a `routePath` used as the document package folder path under `/projects/{projectId}/...`.
- Every visible route folder is a document. For example, `prd/` is a PRD document package and `prd/marklog-local/` is a child document package under it; do not model `prd/` as a plain category directory in the human-facing tree.
- Publishing regenerates generated `INDEX.md` files for AI navigation. Only files containing the `marklog:generated-folder-index` marker are overwritten or removed.
- AI-produced HTML is normalized server-side in `src/server/renderer.ts`. Full HTML documents are preserved, and HTML fragments are wrapped in a default document shell.
- The renderer actively adds stable section anchors, GEO anchors, and the Marklog planning structure contract. Preserve this so `#section` links remain durable across latest and fixed-revision URLs.
- The project viewer should keep the document itself central. The right side is reserved for History only.
- The visible tree should show only user-facing document package folders/pages. Use the real project name as the root label, and show each document node by its document title in one row instead of rendering both the route slug and title as separate tree lines. Keep generated `INDEX.md`, `source.html`, `manifest.json`, `index.css`, `mock/`, `assets/`, and other internal package files hidden from the app tree unless a dedicated package inspector is added.
- Viewer comments should appear at their selected document location with a visible marker. Match by selector/offset first, then section and quote context, then selected text fallback.
- AI-generated HTML can include wireframes and low-poly mockups when that makes a planning document easier for humans and AI to understand.
- Preview rendering must not write files or create commits.
- The browser UI is a viewer/comment surface. Do not add destructive workspace actions such as reset to the UI or public API.
- Document creation materializes a draft package folder with `{routePath}/index.html`, `{routePath}/index.css`, `{routePath}/manifest.json`, `{routePath}/INDEX.md`, `{routePath}/mock/README.md`, and `{routePath}/assets/README.md`.
- Publish writes `{routePath}/source.html`, `{routePath}/index.html`, `{routePath}/index.css`, `{routePath}/manifest.json`, `{routePath}/mock/README.md`, `{routePath}/assets/README.md`, and generated folder/package `INDEX.md` files, then commits them, then inserts the `revisions` row.
- Project push uses the existing Git remote. It is exposed through API for AI agents and must not be surfaced as a human-facing browser button.
- Project reindex uses `POST /api/projects/:projectId/reindex` to regenerate generated `INDEX.md` files without publishing a document.
- Comment export uses `POST /api/revisions/:revisionId/comments/export` to write `.marklog/comments/{revisionId}.jsonl`; pass `{ "commit": true }` when the export should be committed.
- Revision detail and HTML export read committed file contents using `git show`.
- Restore copies a revision's committed source HTML into the current draft and does not commit immediately.
- HTML preview iframes should remain sandboxed so scripts do not run.
- Published viewer routes intentionally inject a small Marklog script for selection-based comments. Keep this separate from committed HTML and do not inject it into `?download=1` responses.

## API Surface

Core routes:

- `GET /api/workspace/status`
- `POST /api/workspace/init`
- `GET /api/network/urls`
- `GET /api/qr.svg?url=...`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/push`
- `POST /api/projects/:projectId/reindex`
- `GET /api/projects/:projectId/documents`
- `POST /api/projects/:projectId/documents`
- `GET /api/documents/:documentId`
- `PATCH /api/documents/:documentId`
- `DELETE /api/documents/:documentId`
- `POST /api/documents/:documentId/preview`
- `POST /api/documents/:documentId/publish`
- `GET /api/documents/:documentId/revisions`
- `GET /api/revisions/:revisionId`
- `GET /api/revisions/:revisionId/comments`
- `POST /api/revisions/:revisionId/comments`
- `POST /api/revisions/:revisionId/comments/export`
- `POST /api/revisions/diff`
- `POST /api/revisions/:revisionId/restore`
- `GET /api/revisions/:revisionId/html`

Published HTML routes:

- `GET /p/:documentId`
- `GET /p/:documentId/:revisionRef`
- `GET /projects/:projectId/*`

Client app routes:

- `GET /`
- `GET /projects`
- `GET /projects/:projectId`
- `GET /settings`

AI CLI:

- `pnpm marklog -- create-project --name <name> --description <text>`
- `pnpm marklog -- list-projects`
- `pnpm marklog -- create-doc --project <id> --title <title> --path <route> --source-file <html>`
- `pnpm marklog -- publish-doc --document <id> --source-file <html> --message <text>`
- `pnpm marklog -- publish-doc --project <id> --path <route> --source-file <html> --message <text>`
- `pnpm marklog -- reindex --project <id> --commit`
- `pnpm marklog -- export-comments --revision <revisionId> --commit --output comments.jsonl`
- `pnpm marklog -- push --project <id> --remote origin --branch <branch>`

## Testing Expectations

Before handing off code changes, run:

```sh
pnpm typecheck
pnpm test
pnpm build
```

For changes touching publish, Git, SQLite, or restore behavior, add or update `tests/api.test.ts` so the full flow remains covered.

For UI-heavy changes, also run the app locally and manually verify:

- dashboard
- projects list
- project viewer
- document package tree
- latest document iframe
- revision switching
- QR sharing
- viewer comments on published pages

Do not reintroduce human-facing create/edit/publish/archive/restore/download controls unless the product direction changes explicitly.

Before pushing this source repository, confirm the folder is actually a Git repository, workspace data is outside the repo, and `README.md` plus this file describe new workflow changes.

## Safety Rules

- Keep app data local. Do not introduce external network calls for core flows.
- Keep the server bound to `127.0.0.1` by default.
- Do not read files outside the configured workspace except for app config and Git executable checks.
- Do not commit drafts on autosave; only publish creates Git commits.
- Do not delete project repository files on ordinary project delete unless the API explicitly implements a confirmed destructive delete flow.
- Preserve deterministic HTML output as much as possible.
