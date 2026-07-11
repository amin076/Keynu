import type { Driver, DriverResult } from "../../core/Driver.js";
import { existsSync } from "node:fs";

export class BlenderDriver implements Driver {
  readonly id = "blender";

  async initialize(): Promise<void> {
    console.log("Blender Driver Ready");
  }

  async execute(command: unknown): Promise<DriverResult> {
    const request = command as any;

    if (request.action === "ping") {
      return {
        success: true,
        message: "Blender driver online"
      };
    }

    if (request.action === "checkExecutable") {
      const path = request.payload?.path;
      return {
        success: true,
        data: {
          path,
          exists: path ? existsSync(path) : false
        }
      };
    }

    throw new Error(`Unknown blender action: ${request.action}`);
  }
}
