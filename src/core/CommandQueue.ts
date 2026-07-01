import fs from "node:fs/promises";
import path from "node:path";
import type { Task } from "../models/Task.js";
import { isTask } from "../models/Task.js";

export class CommandQueue {
  private readonly inbox = path.resolve("inbox");
  private readonly processed = path.resolve("processed");
  private readonly failed = path.resolve("failed");

  async next(): Promise<Task | null> {
    await this.ensureFolders();

    const files = (await fs.readdir(this.inbox))
      .filter((file) => file.endsWith(".json"))
      .sort();

    if (files.length === 0) return null;

    const file = files[0];
    const fullPath = path.join(this.inbox, file);
    const text = await fs.readFile(fullPath, "utf8");

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      await this.moveToFailed(fullPath, file);
      console.warn(`Invalid JSON moved to failed: ${file}`);
      return null;
    }

    if (!isTask(parsed)) {
      await this.moveToFailed(fullPath, file);
      console.warn(`Invalid task moved to failed: ${file}`);
      return null;
    }

    await fs.rename(fullPath, path.join(this.processed, file));
    return parsed;
  }

  private async ensureFolders(): Promise<void> {
    await fs.mkdir(this.inbox, { recursive: true });
    await fs.mkdir(this.processed, { recursive: true });
    await fs.mkdir(this.failed, { recursive: true });
  }

  private async moveToFailed(fullPath: string, file: string): Promise<void> {
    await fs.rename(fullPath, path.join(this.failed, file));
  }
}
