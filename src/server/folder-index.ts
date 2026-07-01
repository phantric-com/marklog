export type AiIndexEntry = {
  title: string;
  documentId: string;
  routePath: string;
  status: string;
  versionLabel: string;
  publishedAt: string;
  publicUrl: string;
  sourcePath: string;
  htmlPath: string;
  cssPath: string;
  manifestPath: string;
  packageIndexPath: string;
  mockPath: string;
  assetsPath: string;
};

export type AiFolderIndexFile = {
  relativePath: string;
  contents: string;
};

const generatedMarker = "<!-- marklog:generated-folder-index -->";

export function generateAiFolderIndexes(input: {
  projectId: string;
  projectName: string;
  generatedAt: string;
  entries: AiIndexEntry[];
}): AiFolderIndexFile[] {
  const sortedEntries = [...input.entries].sort((left, right) => left.routePath.localeCompare(right.routePath));
  const folderPaths = collectFolderPaths(sortedEntries);

  const indexFiles = [...folderPaths].sort(compareFolderPaths).map((folderPath) => ({
    relativePath: folderPath ? `${folderPath}/INDEX.md` : "INDEX.md",
    contents: renderFolderIndex({
      ...input,
      folderPath,
      childFolders: childFoldersFor(folderPath, folderPaths),
      documents: documentsFor(folderPath, sortedEntries)
    })
  }));

  return [
    {
      relativePath: "llms.txt",
      contents: renderLlmsTxt({ ...input, entries: sortedEntries })
    },
    ...indexFiles
  ];
}

export function isGeneratedAiFolderIndex(contents: string): boolean {
  return contents.includes(generatedMarker);
}

function collectFolderPaths(entries: AiIndexEntry[]): Set<string> {
  const folders = new Set<string>([""]);
  for (const entry of entries) {
    const segments = entry.routePath.split("/").filter(Boolean);
    for (let index = 1; index <= segments.length; index += 1) {
      folders.add(segments.slice(0, index).join("/"));
    }
  }
  return folders;
}

function childFoldersFor(folderPath: string, folderPaths: Set<string>): string[] {
  return [...folderPaths]
    .filter((candidate) => candidate !== "" && parentPath(candidate) === folderPath)
    .sort(compareFolderPaths);
}

function documentsFor(folderPath: string, entries: AiIndexEntry[]): AiIndexEntry[] {
  return entries.filter((entry) => parentPath(entry.routePath) === folderPath);
}

function renderFolderIndex(input: {
  projectId: string;
  projectName: string;
  generatedAt: string;
  folderPath: string;
  childFolders: string[];
  documents: AiIndexEntry[];
  entries: AiIndexEntry[];
}): string {
  const folderLabel = input.folderPath || "/";
  const packageEntry = input.entries.find((entry) => entry.routePath === input.folderPath);
  const childFolderRows = input.childFolders
    .map((folderPath) => `| ${mdCell(folderName(folderPath))} | \`${mdCell(folderPath)}\` |`)
    .join("\n");
  const documentRows = input.documents
    .map(
      (entry) =>
        `| ${mdCell(entry.title)} | \`${mdCell(entry.routePath)}/\` | ${mdCell(entry.versionLabel)} | ${mdCell(
          entry.publishedAt
        )} | ${mdLink("HTML", entry.publicUrl)} | \`${mdCell(entry.packageIndexPath)}\` |`
    )
    .join("\n");
  const packageSection = packageEntry
    ? renderDocumentPackageSection(packageEntry)
    : "This folder is an AI navigation folder, not a document package.";

  return `${generatedMarker}
# Marklog AI Index: ${input.projectName} / ${folderLabel}

## Folder Metadata

- project_id: \`${input.projectId}\`
- folder_path: \`${folderLabel}\`
- generated_at: \`${input.generatedAt}\`
- total_published_documents: ${input.entries.length}
- child_folder_count: ${input.childFolders.length}
- direct_document_count: ${input.documents.length}

## Retrieval Rules

- Treat this file as the AI navigation index for the folder path above.
- Use child folders to continue traversal.
- Treat document route paths as package folder paths.
- Use the HTML link for the latest published output.
- Add \`?revision=vN\` to a public URL when a fixed revision is required.
- Use each document package \`INDEX.md\` before reading individual package files.
- Read \`manifest.json\` before reading \`index.html\`; it contains GEO metadata, section anchors, package paths, and the section contract.
- Prefer \`#answer-summary\` and \`#source-of-truth\` before deeper sections when answering a question.

## This Folder Answers

- What document packages exist below this folder?
- Which document package is canonical for this route path?
- Which section anchors should an AI cite first?
- Which package files should be read before HTML content?
- Which stable decisions and open questions need follow-up?

## GEO Read Order

1. \`llms.txt\` at repository root.
2. This \`INDEX.md\`.
3. A document package \`manifest.json\`.
4. The package \`INDEX.md\`.
5. \`index.html#answer-summary\`, \`index.html#source-of-truth\`, then task-specific section anchors.

## Document Package

${packageSection}

## Child Folders

| Folder | Route path |
| --- | --- |
${childFolderRows || "| None |  |"}

## Documents

| Title | Package path | Latest version | Published at | Latest HTML | Package index |
| --- | --- | --- | --- | --- | --- |
${documentRows || "| None |  |  |  |  |  |"}
`;
}

function renderDocumentPackageSection(entry: AiIndexEntry): string {
  return `This folder is a Marklog document package.

- title: ${mdCell(entry.title)}
- document_id: \`${entry.documentId}\`
- route_path: \`${entry.routePath}/\`
- latest_version: \`${entry.versionLabel}\`
- public_url: ${mdLink(entry.publicUrl, entry.publicUrl)}

### GEO Entry Points

- answer_summary: ${mdLink(`${entry.publicUrl}#answer-summary`, `${entry.publicUrl}#answer-summary`)}
- source_of_truth: ${mdLink(`${entry.publicUrl}#source-of-truth`, `${entry.publicUrl}#source-of-truth`)}
- requirements: ${mdLink(`${entry.publicUrl}#requirements`, `${entry.publicUrl}#requirements`)}

### Package Contents

| Path | Purpose |
| --- | --- |
| \`${mdCell(entry.htmlPath)}\` | Viewer HTML entrypoint |
| \`${mdCell(entry.cssPath)}\` | Package stylesheet |
| \`${mdCell(entry.sourcePath)}\` | Source HTML snapshot used for restore and diff |
| \`${mdCell(entry.manifestPath)}\` | Revision/package manifest |
| \`${mdCell(entry.packageIndexPath)}\` | AI-readable document package index |
| \`${mdCell(entry.mockPath)}\` | Mockup and wireframe assets |
| \`${mdCell(entry.assetsPath)}\` | Images and other document assets |`;
}

function renderLlmsTxt(input: {
  projectId: string;
  projectName: string;
  generatedAt: string;
  entries: AiIndexEntry[];
}): string {
  const documentRows = input.entries
    .map(
      (entry) =>
        `- ${entry.title}: ${entry.publicUrl} (manifest: ${entry.manifestPath}, ai-index: ${entry.packageIndexPath})`
    )
    .join("\n");

  return `# ${input.projectName}

<!-- marklog:generated-llms -->

Marklog project id: ${input.projectId}
Generated at: ${input.generatedAt}

## Purpose

This repository contains Marklog HTML document packages. It is optimized for humans to review in a local browser and for AI agents to read, cite, reindex, revise, commit, and push through CLI/API workflows.

## Read First

1. INDEX.md
2. The nearest folder INDEX.md for the route path.
3. The document package manifest.json.
4. The document package INDEX.md.
5. index.html#answer-summary and index.html#source-of-truth.

## Important Rules

- A visible document is a folder package, not a single HTML file.
- Humans view, navigate revisions, and comment.
- AI agents create, update, publish, reindex, export comments, commit, and push.
- Use stable section anchors such as #answer-summary, #source-of-truth, #summary, #requirements, #wireframe, and #open-questions when citing.
- Treat generated INDEX.md files as navigation aids and manifest.json as the package contract.

## Documents

${documentRows || "- No published documents yet."}
`;
}

function parentPath(routePath: string): string {
  const segments = routePath.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

function folderName(folderPath: string): string {
  return folderPath.split("/").filter(Boolean).at(-1) ?? "/";
}

function compareFolderPaths(left: string, right: string): number {
  if (left === right) return 0;
  if (left === "") return -1;
  if (right === "") return 1;
  return left.localeCompare(right);
}

function mdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function mdLink(label: string, href: string): string {
  return `[${mdCell(label)}](${href.replace(/\)/g, "%29")})`;
}
