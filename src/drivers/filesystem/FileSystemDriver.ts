import fs from "node:fs/promises";
import path from "node:path";
import type { Driver } from "../../core/Driver.js";

type FileSystemCommand = {
  action: string;
  payload?: unknown;
};

type WriteFilePayload = {
  path: string;
  content: string;
};

type ReadFilePayload = {
  path: string;
};

export class FileSystemDriver implements Driver {
  readonly id = "filesystem";

  async initialize(): Promise<void> {
    console.log("FileSystem Driver Ready");
  }

  async execute(command: unknown): Promise<void> {
    const fileCommand = command as FileSystemCommand;

    if (fileCommand.action === "writeFile") {
      const payload = this.requireWritePayload(fileCommand.payload);
      const targetPath = path.resolve(payload.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, payload.content, "utf8");
      console.log(`File written: ${targetPath}`);
      return;
    }

    if (fileCommand.action === "readFile") {
      const payload = this.requireReadPayload(fileCommand.payload);
      const targetPath = path.resolve(payload.path);
      const content = await fs.readFile(targetPath, "utf8");
      console.log(content);
      return;
    }

    console.warn("Unknown FileSystem action:", fileCommand.action);
  }

  private requireWritePayload(payload: unknown): WriteFilePayload {
    if (!payload || typeof payload !== "object") {
      throw new Error("writeFile payload must be an object.");
    }

    const value = payload as Partial<WriteFilePayload>;

    if (typeof value.path !== "string" || !value.path.trim()) {
      throw new Error("writeFile payload.path must be a non-empty string.");
    }

    if (typeof value.content !== "string") {
      throw new Error("writeFile payload.content must be a string.");
    }

    return {
      path: value.path,
      content: value.content,
    };
  }

  private requireReadPayload(payload: unknown): ReadFilePayload {
    if (!payload || typeof payload !== "object") {
      throw new Error("readFile payload must be an object.");
    }

    const value = payload as Partial<ReadFilePayload>;

    if (typeof value.path !== "string" || !value.path.trim()) {
      throw new Error("readFile payload.path must be a non-empty string.");
    }

    return {
      path: value.path,
    };
  }
}
