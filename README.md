# Marklog Local

Marklog Local is a local-first planning document archive server. It is meant to be shared as source code on GitHub, then cloned and run on a user's own machine.

This is not a hosted deployment target. Humans use the browser to view and comment. AI agents use the API to create document packages, publish local Git revisions, and push when a project repository has a configured remote.

## Requirements

- Node.js 25 or newer
- pnpm 10 or newer
- Git CLI

## Run From A Clone

```sh
git clone <repo-url>
cd marklog-project
pnpm install
pnpm dev
```

Open:

```text
http://127.0.0.1:3333
```

On first run, initialize a workspace from the dashboard. The dashboard is empty until an AI agent creates a project through the API or CLI.

For a built local server:

```sh
pnpm build
pnpm start
```

For same-Wi-Fi access:

```sh
pnpm dev:lan
```

or:

```sh
pnpm build
pnpm start:lan
```

The app will show LAN URLs and QR codes when it is running in LAN mode.

Use LAN mode only when people on the same Wi-Fi should be able to view documents and add comments from their devices.

## What It Does

- Lets AI agents create local projects and document packages through API routes.
- Treats each document as a folder package, not a single HTML file.
- Uses `manifest.json` as the package contract for entry files, AI index files, assets, GEO metadata, and section metadata.
- Stores drafts in SQLite.
- Publishes revisions into a project-local Git repository.
- Pushes a project repository through an AI-facing API when a Git remote exists.
- Serves latest or fixed-revision HTML locally.
- Compares two revisions with line-based unified and side-by-side diff views.
- Supports GEO-ready section anchors like `#answer-summary`, `#source-of-truth`, `#wireframe`, and `#decision-log`.
- Adds revision-scoped viewer comments that appear at the selected document location using section, selector, text offset, and surrounding text anchors.
- Provides light/dark theme and Korean/English UI preferences for the local viewer shell.

Example document package:

```text
repositories/
  {projectId}/
    {routePath}/
      index.html
      index.css
      source.html
      manifest.json
      INDEX.md
      mock/
        README.md
      assets/
        README.md
```

`manifest.json` is the package contract. It records the entry HTML, AI index path, source path, asset paths, GEO metadata, review metadata, required section contract, and discovered section anchors so AI agents and reviewers can navigate the package consistently.

Generated project repositories also include `llms.txt` at the repository root. AI agents should read `llms.txt`, the nearest `INDEX.md`, then the document package `manifest.json` before reading HTML content.

## App Routes

- `/`: dashboard
- `/projects`: project browser
- `/projects/{projectId}`: project viewer with source tree, document frame, and history
- `/projects/{projectId}/{routePath}`: latest published document package entrypoint
- `/projects/{projectId}/{routePath}?revision=v1`: fixed revision
- `/projects/{projectId}/{routePath}#wireframe`: section anchor
- `/projects/{projectId}/{routePath}/index.css?revision=v1`: package asset

## Workspace

On first run, initialize a workspace. The default suggestion is:

```text
~/Marklog Workspace
```

The workspace stores the app database and generated project repositories:

```text
app.sqlite
repositories/
```

Workspace data is intentionally outside this source repository.

## Commands

```sh
pnpm dev
pnpm dev:lan
pnpm marklog -- --help
pnpm typecheck
pnpm test
pnpm build
pnpm start
pnpm start:lan
```

AI-facing CLI examples:

```sh
pnpm marklog -- create-project --name "Marklog Local" --description "Local planning document knowledge base"
pnpm marklog -- list-projects
pnpm marklog -- create-doc --project <id> --title "PRD" --path prd --source-file ./prd.html
pnpm marklog -- publish-doc --project <id> --path prd --source-file ./prd.html --message "Initial PRD"
pnpm marklog -- reindex --project <id> --commit
pnpm marklog -- export-comments --revision <revisionId> --commit --output comments.jsonl
pnpm marklog -- push --project <id> --remote origin --branch main
```

## First AI Workflow

1. Start the local server with `pnpm dev` or `pnpm start`.
2. Create a project:

```sh
pnpm marklog -- create-project --name "Marklog Local"
```

3. Use the returned project `id` to create a document package:

```sh
pnpm marklog -- create-doc --project <id> --title "Marklog Local PRD" --path prd/marklog-local --source-file ./prd.html
```

4. Publish the package after the HTML is ready:

```sh
pnpm marklog -- publish-doc --project <id> --path prd/marklog-local --source-file ./prd.html --message "Initial PRD"
```

5. Open `/projects/{projectId}` in the browser. Humans should use the viewer, history, diff, QR sharing, and comments. AI agents should use the CLI/API for creation, publishing, reindexing, comment export, and push.

## AI Document Authoring Contract

- Author source as semantic HTML, not Markdown. A document is a folder package with `index.html`, `index.css`, `source.html`, `manifest.json`, `INDEX.md`, `mock/`, and `assets/`.
- Use stable section anchors so humans and AI agents can link to exact sections: `#answer-summary`, `#source-of-truth`, `#summary`, `#requirements`, `#wireframe`, `#mockup`, `#decision-log`, and `#open-questions`.
- Put concise answer material in `#answer-summary` and durable facts/rules in `#source-of-truth`.
- Include low-fidelity mockups, wireframes, tables, flows, and decision logs when they make the planning document easier to inspect.
- Let Marklog generate `manifest.json`, `INDEX.md`, and `llms.txt` metadata. Use `pnpm marklog -- reindex --project <id> --commit` after metadata-only structure cleanup.

## Data And Safety

- The default workspace is `~/Marklog Workspace`; it is outside this source repository.
- Browser users can view documents and add comments. They should not need create, edit, publish, reset, push, or destructive controls.
- LAN mode exposes the local viewer to people on the same Wi-Fi. Keep the server on `127.0.0.1` for private use.
- Git push is optional and AI-operated. It works only when the generated project repository has a configured remote.
- Do not commit workspace data, generated project repositories, SQLite files, `dist/`, or `node_modules/` to this source repository.

## Troubleshooting

- `node` version errors: install Node.js 25 or newer.
- Port `3333` already in use: stop the old Marklog server or set `PORT=<port>`.
- Empty dashboard: initialize the workspace, then create a project with `pnpm marklog -- create-project`.
- LAN URL not reachable: run `pnpm dev:lan` or `pnpm start:lan`, confirm the devices are on the same Wi-Fi, and check firewall prompts.
- Git publish failure: confirm `git --version` works and the project repository has a valid local Git identity/remote when pushing.

## Pre-push Checklist

Run these before sharing the source repository:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Also confirm:

- `.gitignore` excludes build output, dependencies, app config, and local workspaces.
- README and `AGENTS.md` describe any workflow or API changes.
- The local workspace remains outside the source repository.
- If this folder is not yet a Git repository, initialize it before the first source push.

## Distribution Model

The distribution model is GitHub source sharing:

1. Push this source repository to GitHub.
2. Other users clone or pull it.
3. They install dependencies.
4. They run the local server.
5. Their Marklog workspace and document repositories stay on their own machine unless they choose to share them separately.

No cloud deployment, hosted backend, or login system is required for the core workflow. Git push is optional and AI-operated; it requires a remote configured in the generated project repository.
