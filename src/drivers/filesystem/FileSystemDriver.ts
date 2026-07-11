import type { Driver, DriverResult } from "../../core/Driver.js";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class FileSystemDriver implements Driver {
  readonly id = "filesystem";

  async initialize(): Promise<void> {
    console.log("FileSystem Driver Ready");
  }

  async execute(command: unknown): Promise<DriverResult> {
    const request = command as any;
    const path = request.payload?.path ?? request.path;
    const content = request.payload?.content ?? request.content;

    if (request.action === "readFile" && path) {
      return { success: true, data: readFileSync(path, "utf8") };
    }

    if (request.action === "writeFile" && path) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content ?? "", "utf8");
      return { success: true, message: "File written" };
    }

    if (request.action === "createFolder" && path) {
      mkdirSync(path, { recursive: true });
      return { success: true, message: "Folder created" };
    }

    if (request.action === "listDirectory" && path) {
      return { success: true, data: readdirSync(path) };
    }

    throw new Error(`Unknown filesystem action: ${request.action}`);
  }
}
