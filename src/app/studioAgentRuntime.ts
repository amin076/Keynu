import { CapabilityRegistry } from "../core/CapabilityRegistry.js";
import { CommandBus } from "../core/CommandBus.js";
import { DriverManager } from "../core/DriverManager.js";
import { Runtime } from "../core/Runtime.js";
import { registerBuiltinDrivers } from "../core/registerBuiltinDrivers.js";
import type { Task } from "../models/Task.js";

export async function createStudioAgentRuntime(): Promise<Runtime> {
  const driverManager = new DriverManager();
  const capabilityRegistry = new CapabilityRegistry();
  const commandBus = new CommandBus(driverManager, capabilityRegistry);

  await registerBuiltinDrivers(driverManager, capabilityRegistry);

  return new Runtime(commandBus);
}

export async function runStudioTask(task: Task): Promise<void> {
  const runtime = await createStudioAgentRuntime();
  const result = await runtime.execute(task);

  if (result.status === "failed") {
    throw new Error(result.error ?? "Studio task failed.");
  }
}
