import type { Driver, DriverResult } from "../core/Driver.js";
import { EngineeringRuntime } from "./EngineeringRuntime.js";
import type { EngineeringAction, EngineeringPayload } from "./EngineeringTypes.js";

export class EngineeringDriver implements Driver {
  readonly id = "engineering";
  readonly name = "Engineering Runtime";
  readonly status = "Registered";
  readonly capabilities = [
    "fs.readFile",
    "fs.writeFile",
    "fs.createFolder",
    "fs.listDirectory",
    "fs.exists",
    "command.run",
    "script.run",
    "git.status",
    "git.currentBranch",
    "git.diff",
    "git.log",
    "git.createBranch",
    "git.switchBranch",
    "git.stage",
    "git.commit",
    "project.verify",
  ];

  constructor(private readonly runtime = new EngineeringRuntime()) {}

  async initialize(): Promise<void> {
    // The runtime is stateless. Project roots are validated per operation.
  }

  async execute(command: unknown): Promise<DriverResult> {
    if (!command || typeof command !== "object") {
      throw new Error("Engineering driver requires a command object.");
    }

    const record = command as Record<string, unknown>;
    const action = record.action;
    const payload = record.payload;

    if (typeof action !== "string" || !this.capabilities.includes(action)) {
      throw new Error(`Unsupported engineering action: ${String(action)}`);
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Engineering action requires a payload object.");
    }

    const result = await this.runtime.execute(
      action as EngineeringAction,
      payload as EngineeringPayload,
    );

    return {
      success: result.success,
      message: result.summary,
      data: result,
    };
  }
}
