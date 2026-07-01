import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfigDir } from "./paths.js";

type AppConfig = {
  workspacePath?: string;
};

export class AppConfigStore {
  private readonly configPath: string;

  constructor(configDir = defaultConfigDir()) {
    this.configPath = path.join(configDir, "config.json");
  }

  async readWorkspacePath(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as AppConfig;
      return parsed.workspacePath ?? null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async writeWorkspacePath(workspacePath: string): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify({ workspacePath } satisfies AppConfig, null, 2),
      "utf8"
    );
  }
}
