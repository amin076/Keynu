import type { Driver } from "../../core/Driver.js";

export class FileSystemDriver implements Driver {
  readonly id = "filesystem";

  async initialize(): Promise<void> {
    console.log("FileSystem Driver Ready");
  }

  async execute(command: unknown): Promise<void> {
    console.log(command);
  }
}
