import fs from "node:fs/promises";
import path from "node:path";
import type { Task } from "../models/Task.js";

export class CommandQueue {
  private readonly inbox = path.resolve("inbox");
  private readonly processed = path.resolve("processed");
  private readonly failed = path.resolve("failed");

  async next(): Promise<Task | null> {
    await fs.mkdir(this.inbox, { recursive: true });
    await fs.mkdir(this.processed, { recursive: true });
    await fs.mkdir(this.failed, { recursive: true });

    const files = (await fs.readdir(this.inbox))
      .filter((f) => f.endsWith(".json"))
      .sort();

    if (files.length === 0) return null;

    const file = files[0];
    const fullPath = path.join(this.inbox, file);
    const text = await fs.readFile(fullPath, "utf8");

    let task: unknown;

    try {
      task = JSON.parse(text);
    } catch {
      await fs.rename(fullPath, path.join(this.failed, file));
      return null;
    }

    if (!isTask(task)) {
      await fs.rename(fullPath, path.join(this.failed, file));
      console.warn(`Invalid task moved to failed: ${file}`);
      return null;
    }

    await fs.rename(fullPath, path.join(this.processed, file));
    return task;
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;

  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    typeof task.createdAt === "string" &&
    (task.priority === "low" ||
      task.priority === "normal" ||
      task.priority === "high") &&
    Array.isArray(task.steps)
  );
}