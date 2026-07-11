import {
  access,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  FileSystemRequest,
  FileSystemResult,
} from "./filesystem-types.js";

function safePath(cwd: string, inputPath: string): string {
  const root = resolve(cwd);
  const fullPath = resolve(root, inputPath);

  if (fullPath !== root && !fullPath.startsWith(root + "\\")) {
    throw new Error("Path is outside the approved workspace.");
  }

  return fullPath;
}

export async function executeFileSystemRequest(
  cwd: string,
  request: FileSystemRequest,
): Promise<FileSystemResult> {
  if (!request || typeof request.path !== "string" || request.path.trim().length === 0) {
    throw new Error("Filesystem request requires valid path");
  }

  if (!request.action) {
    throw new Error("Filesystem request requires action");
  }

  const path = safePath(cwd, request.path);

  switch (request.action) {
    case "readFile":
      return {
        summary: "File read successfully.",
        data: { content: await readFile(path, "utf8") },
      };

    case "writeFile":
      if (typeof request.content !== "string") {
        throw new Error("writeFile requires string content");
      }

      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, request.content, "utf8");
      return {
        summary: "File written successfully.",
        changed: [request.path],
      };

    case "createFolder":
      await mkdir(path, { recursive: true });
      return {
        summary: "Folder created successfully.",
        changed: [request.path],
      };

    case "listDirectory":
      return {
        summary: "Directory listed successfully.",
        data: { entries: await readdir(path) },
      };

    case "exists":
      try {
        await access(path);
        return { summary: "Path checked.", data: { exists: true } };
      } catch {
        return { summary: "Path checked.", data: { exists: false } };
      }
  }
}
