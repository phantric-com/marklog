#!/usr/bin/env node
import fs from "node:fs/promises";

import type {
  CommentExportResponse,
  DocumentRecord,
  GitPushResponse,
  Project,
  PublishResponse,
  ReindexResponse
} from "./shared/types.js";

type CliOptions = Record<string, string | boolean>;

const defaultServer = process.env.MARKLOG_SERVER ?? "http://127.0.0.1:3333";

async function main(argv: string[]): Promise<void> {
  const rawArgs = argv.slice(2);
  const normalizedArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const [command, ...args] = normalizedArgs;
  const options = parseOptions(args);
  const server = String(options.server || defaultServer).replace(/\/+$/, "");

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "create-project") {
    const name = requiredOption(options, "name");
    const project = await request<Project>(server, "/api/projects", {
      method: "POST",
      body: {
        name,
        description: stringOption(options, "description") ?? ""
      }
    });
    writeJson(project);
    return;
  }

  if (command === "list-projects") {
    const projects = await request<Project[]>(server, "/api/projects");
    writeJson(projects);
    return;
  }

  if (command === "create-doc") {
    const projectId = requiredOption(options, "project");
    const title = requiredOption(options, "title");
    const source = await optionalSource(options);
    const document = await request<DocumentRecord>(server, `/api/projects/${encodeURIComponent(projectId)}/documents`, {
      method: "POST",
      body: {
        title,
        routePath: stringOption(options, "path"),
        currentDraft: source
      }
    });
    writeJson(document);
    return;
  }

  if (command === "publish-doc") {
    const documentId = await resolveDocumentId(server, options);
    const source = await optionalSource(options);
    const response = await request<PublishResponse>(server, `/api/documents/${encodeURIComponent(documentId)}/publish`, {
      method: "POST",
      body: {
        source,
        message: stringOption(options, "message") ?? ""
      }
    });
    writeJson(response);
    return;
  }

  if (command === "push") {
    const projectId = requiredOption(options, "project");
    const response = await request<GitPushResponse>(server, `/api/projects/${encodeURIComponent(projectId)}/push`, {
      method: "POST",
      body: {
        remote: stringOption(options, "remote"),
        branch: stringOption(options, "branch")
      }
    });
    writeJson(response);
    return;
  }

  if (command === "reindex") {
    const projectId = requiredOption(options, "project");
    const response = await request<ReindexResponse>(server, `/api/projects/${encodeURIComponent(projectId)}/reindex`, {
      method: "POST",
      body: {
        commit: Boolean(options.commit)
      }
    });
    writeJson(response);
    return;
  }

  if (command === "export-comments") {
    const revisionId = requiredOption(options, "revision");
    const response = await request<CommentExportResponse>(
      server,
      `/api/revisions/${encodeURIComponent(revisionId)}/comments/export`,
      {
        method: "POST",
        body: {
          commit: Boolean(options.commit)
        }
      }
    );
    const output = stringOption(options, "output");
    if (output) {
      await fs.writeFile(output, response.jsonl, "utf8");
    }
    writeJson(response);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function resolveDocumentId(server: string, options: CliOptions): Promise<string> {
  const documentId = stringOption(options, "document");
  if (documentId) {
    return documentId;
  }
  const projectId = requiredOption(options, "project");
  const routePath = requiredOption(options, "path").replace(/\/+$/, "");
  const documents = await request<DocumentRecord[]>(server, `/api/projects/${encodeURIComponent(projectId)}/documents`);
  const document = documents.find((entry) => entry.routePath === routePath);
  if (!document) {
    throw new Error(`Document not found for project/path: ${projectId}/${routePath}`);
  }
  return document.id;
}

async function optionalSource(options: CliOptions): Promise<string | undefined> {
  const sourceFile = stringOption(options, "source-file");
  if (!sourceFile) {
    return undefined;
  }
  return fs.readFile(sourceFile, "utf8");
}

async function request<T>(
  server: string,
  route: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${server}${route}`, {
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
        : String(payload || response.statusText);
    throw new Error(message);
  }
  return payload as T;
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const name = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[name] = true;
      continue;
    }
    options[name] = next;
    index += 1;
  }
  return options;
}

function requiredOption(options: CliOptions, key: string): string {
  const value = stringOption(options, key);
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function stringOption(options: CliOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp(): void {
  process.stdout.write(`Marklog AI CLI

Usage:
  marklog create-project --name <name> [--description <text>]
  marklog list-projects
  marklog create-doc --project <id> --title <title> [--path <route>] [--source-file <html>]
  marklog publish-doc --document <id> [--source-file <html>] [--message <text>]
  marklog publish-doc --project <id> --path <route> [--source-file <html>] [--message <text>]
  marklog push --project <id> [--remote origin] [--branch main]
  marklog reindex --project <id> [--commit]
  marklog export-comments --revision <id> [--commit] [--output comments.jsonl]

Options:
  --server <url>  Defaults to MARKLOG_SERVER or ${defaultServer}
`);
}

main(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`marklog: ${message}\n`);
  process.exitCode = 1;
});
