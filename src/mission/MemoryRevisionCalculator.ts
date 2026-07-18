import { createHash } from "node:crypto";
import type {
  MissionContext,
  MissionMemoryDocument,
} from "./MissionTypes.js";

export type MemoryRevisionSource = {
  path: string;
  content: string;
};

export type MemoryRevisionResult = {
  algorithm: "sha256";
  revision: string;
  sourceCount: number;
  sources: Array<{
    path: string;
    bytes: number;
  }>;
};

function normalizePath(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");

  const memoryMarker = "/.keynu/memory/";
  const memoryIndex = normalized.toLowerCase().indexOf(memoryMarker);

  if (memoryIndex >= 0) {
    return normalized.slice(memoryIndex + 1);
  }

  return normalized;
}

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) =>
    left.localeCompare(right),
  );

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

type AvailableMemoryDocument = MissionMemoryDocument & {
  path: string;
  content: string;
};

function isAvailableMemoryDocument(
  document: MissionMemoryDocument,
): document is AvailableMemoryDocument {
  return (
    document.exists !== false &&
    typeof document.path === "string" &&
    typeof document.content === "string"
  );
}

function memoryDocumentsToSources(
  memory: MissionMemoryDocument[],
): MemoryRevisionSource[] {
  return memory
    .filter(isAvailableMemoryDocument)
    .map((document) => ({
      path: normalizePath(document.path),
      content: normalizeContent(document.content),
    }));
}

export class MemoryRevisionCalculator {
  calculate(context: MissionContext): MemoryRevisionResult {
    const sources: MemoryRevisionSource[] = [
      ...memoryDocumentsToSources(context.memory),
      {
        path: "mission://active-definition",
        content: stableSerialize(context.mission),
      },
      {
        path: "protocol://kap-version",
        content: "1.0",
      },
    ]
      .map((source) => ({
        path: normalizePath(source.path),
        content: normalizeContent(source.content),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));

    const hash = createHash("sha256");

    for (const source of sources) {
      const pathBytes = Buffer.from(source.path, "utf8");
      const contentBytes = Buffer.from(source.content, "utf8");

      hash.update(String(pathBytes.length));
      hash.update(":");
      hash.update(pathBytes);
      hash.update(":");
      hash.update(String(contentBytes.length));
      hash.update(":");
      hash.update(contentBytes);
      hash.update("\n");
    }

    return {
      algorithm: "sha256",
      revision: hash.digest("hex"),
      sourceCount: sources.length,
      sources: sources.map((source) => ({
        path: source.path,
        bytes: Buffer.byteLength(source.content, "utf8"),
      })),
    };
  }
}
