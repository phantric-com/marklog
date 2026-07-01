import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit, type SimpleGit } from "simple-git";

import type { GitStatus } from "../shared/types.js";

const execFileAsync = promisify(execFile);

export async function checkGit(): Promise<GitStatus> {
  try {
    const result = await execFileAsync("git", ["--version"]);
    return {
      available: true,
      version: result.stdout.trim(),
      error: null
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function gitFor(repoPath: string): SimpleGit {
  return simpleGit({
    baseDir: repoPath,
    binary: "git",
    maxConcurrentProcesses: 1
  });
}

export async function configureLocalGitIdentity(git: SimpleGit): Promise<void> {
  await git.addConfig("user.name", "Marklog Local", false, "local");
  await git.addConfig("user.email", "marklog@local.invalid", false, "local");
}
