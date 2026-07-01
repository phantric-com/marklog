import fs from "node:fs/promises";

import { MarklogDb } from "./db.js";
import { AppConfigStore } from "./config.js";
import {
  databasePathFor,
  normalizeWorkspacePath,
  pathExists,
  repositoriesPathFor,
  suggestedWorkspacePath
} from "./paths.js";
import { checkGit } from "./git.js";
import type { WorkspaceStatus } from "../shared/types.js";

export type WorkspaceManagerOptions = {
  configDir?: string;
  workspacePath?: string;
};

export class WorkspaceManager {
  private readonly configStore: AppConfigStore;
  private configuredWorkspacePath: string | null;
  private db: MarklogDb | null = null;

  constructor(options: WorkspaceManagerOptions = {}) {
    this.configStore = new AppConfigStore(options.configDir);
    this.configuredWorkspacePath = options.workspacePath
      ? normalizeWorkspacePath(options.workspacePath)
      : process.env.MARKLOG_WORKSPACE
        ? normalizeWorkspacePath(process.env.MARKLOG_WORKSPACE)
        : null;
  }

  async loadConfiguredWorkspace(): Promise<void> {
    if (!this.configuredWorkspacePath) {
      this.configuredWorkspacePath = await this.configStore.readWorkspacePath();
    }

    if (!this.configuredWorkspacePath) {
      return;
    }

    const dbPath = databasePathFor(this.configuredWorkspacePath);
    if (await pathExists(dbPath)) {
      await fs.mkdir(repositoriesPathFor(this.configuredWorkspacePath), { recursive: true });
      this.db = new MarklogDb(dbPath);
    }
  }

  async initialize(inputPath?: string | null): Promise<WorkspaceStatus> {
    const workspacePath = normalizeWorkspacePath(inputPath ?? this.configuredWorkspacePath);
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(repositoriesPathFor(workspacePath), { recursive: true });
    this.close();
    this.db = new MarklogDb(databasePathFor(workspacePath));
    this.configuredWorkspacePath = workspacePath;
    await this.configStore.writeWorkspacePath(workspacePath);
    return this.status();
  }

  async status(): Promise<WorkspaceStatus> {
    const workspacePath = this.db ? this.configuredWorkspacePath : null;
    return {
      initialized: Boolean(this.db && workspacePath),
      workspacePath,
      suggestedWorkspacePath: suggestedWorkspacePath(),
      databasePath: workspacePath ? databasePathFor(workspacePath) : null,
      git: await checkGit()
    };
  }

  requireDb(): MarklogDb {
    if (!this.db) {
      throw new WorkspaceNotInitializedError();
    }
    return this.db;
  }

  requireWorkspacePath(): string {
    if (!this.db || !this.configuredWorkspacePath) {
      throw new WorkspaceNotInitializedError();
    }
    return this.configuredWorkspacePath;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}

export class WorkspaceNotInitializedError extends Error {
  constructor() {
    super("Workspace is not initialized");
    this.name = "WorkspaceNotInitializedError";
  }
}
