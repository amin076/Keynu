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

    const file = await this.getNextJsonFile();

    if (!file) {
      return null;
    }

    const fullPath = path.join(this.inbox, file);
    const parsed = await this.readTaskFile(fullPath, file);

    if (!parsed) {
      return null;
    }

    await this.moveToProcessed(fullPath, file);

    return parsed;
  }

  private async getNextJsonFile(): Promise<string | null> {
    const files = (await fs.readdir(this.inbox))
      .filter((file) => file.endsWith(".json"))
      .sort();

    return files[0] ?? null;
  }

  private async readTaskFile(
    fullPath: string,
    file: string,
  ): Promise<Task | null> {
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

    return parsed;
  }

  private async ensureFolders(): Promise<void> {
    await fs.mkdir(this.inbox, { recursive: true });
    await fs.mkdir(this.processed, { recursive: true });
    await fs.mkdir(this.failed, { recursive: true });
  }

  private async moveToProcessed(fullPath: string, file: string): Promise<void> {
    await fs.rename(fullPath, path.join(this.processed, file));
  }

  private async moveToFailed(fullPath: string, file: string): Promise<void> {
    await fs.rename(fullPath, path.join(this.failed, file));
  }
}
