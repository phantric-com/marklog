import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const repositoriesDirName = "repositories";
export const databaseFileName = "app.sqlite";

export function suggestedWorkspacePath(): string {
  return path.join(os.homedir(), "Marklog Workspace");
}

export function defaultConfigDir(): string {
  return process.env.MARKLOG_CONFIG_DIR ?? path.join(os.homedir(), ".marklog");
}

export function normalizeWorkspacePath(inputPath?: string | null): string {
  return path.resolve(inputPath?.trim() || suggestedWorkspacePath());
}

export function databasePathFor(workspacePath: string): string {
  return path.join(workspacePath, databaseFileName);
}

export function repositoriesPathFor(workspacePath: string): string {
  return path.join(workspacePath, repositoriesDirName);
}

export function ensureInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${candidate}`);
  }
  return resolvedCandidate;
}

export async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}
