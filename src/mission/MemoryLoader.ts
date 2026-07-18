import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MissionMemoryDocument } from "./MissionTypes.js";

export type MemoryLoaderOptions = {
  memoryDirectory?: string;
  staleAfterDays?: number;
  maximumDocumentBytes?: number;
};

const DEFAULT_MEMORY_FILES = [
  "current_state.md",
  "architecture.md",
  "decisions.md",
  "next_steps.md",
  "startup_prompt.md",
] as const;

export class MemoryLoader {
  private readonly memoryDirectory: string;
  private readonly staleAfterMs: number;
  private readonly maximumDocumentBytes: number;

  constructor(
    private readonly projectRoot = process.cwd(),
    options: MemoryLoaderOptions = {},
  ) {
    this.memoryDirectory =
      options.memoryDirectory ?? join(projectRoot, ".keynu", "memory");
    this.staleAfterMs =
      Math.max(1, options.staleAfterDays ?? 30) * 24 * 60 * 60 * 1000;
    this.maximumDocumentBytes = Math.max(
      1024,
      options.maximumDocumentBytes ?? 128 * 1024,
    );
  }

  loadAll(): MissionMemoryDocument[] {
    return DEFAULT_MEMORY_FILES.map((name) => this.loadDocument(name));
  }

  loadDocument(name: string): MissionMemoryDocument {
    const path = join(this.memoryDirectory, name);

    if (!existsSync(path)) {
      return {
        name,
        path,
        exists: false,
      };
    }

    const stat = statSync(path);
    const modifiedAt = stat.mtime.toISOString();
    const stale = Date.now() - stat.mtimeMs > this.staleAfterMs;

    if (stat.size > this.maximumDocumentBytes) {
      return {
        name,
        path,
        exists: true,
        modifiedAt,
        bytes: stat.size,
        stale,
        content: readFileSync(path, "utf8").slice(0, this.maximumDocumentBytes),
      };
    }

    return {
      name,
      path,
      exists: true,
      modifiedAt,
      bytes: stat.size,
      stale,
      content: readFileSync(path, "utf8"),
    };
  }

  getMissingDocuments(): string[] {
    return this.loadAll()
      .filter((document) => !document.exists)
      .map((document) => document.name);
  }

  getStaleDocuments(): string[] {
    return this.loadAll()
      .filter((document) => document.exists && document.stale)
      .map((document) => document.name);
  }

  getCombinedContent(): string {
    return this.loadAll()
      .filter(
        (document): document is MissionMemoryDocument & { content: string } =>
          document.exists && typeof document.content === "string",
      )
      .map(
        (document) =>
          `# Memory Document: ${document.name}\n\n${document.content.trim()}`,
      )
      .join("\n\n---\n\n");
  }
}
