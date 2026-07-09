import { CapabilityRegistry } from "./CapabilityRegistry.js";
import { DriverManager } from "./DriverManager.js";
import { DehleroDriver } from "../drivers/dehlero/DehleroDriver.js";
import { FileSystemDriver } from "../drivers/filesystem/FileSystemDriver.js";

export async function registerBuiltinDrivers(
  manager: DriverManager,
  capabilities?: CapabilityRegistry,
): Promise<void> {
  manager.register(new FileSystemDriver());
  manager.register(new DehleroDriver());

  registerBuiltinCapabilities(capabilities);

  await manager.initialize();
}

function registerBuiltinCapabilities(capabilities?: CapabilityRegistry): void {
  if (!capabilities) {
    return;
  }

  capabilities.register({
    name: "filesystem.writeFile",
    driver: "filesystem",
    action: "writeFile",
    description: "Write a UTF-8 text file to disk.",
  });

  capabilities.register({
    name: "filesystem.readFile",
    driver: "filesystem",
    action: "readFile",
    description: "Read a UTF-8 text file from disk.",
  });

  capabilities.register({
    name: "dehlero.sendCommand",
    driver: "dehlero",
    action: "sendCommand",
    description: "Send a command payload to the Dehlero runtime API.",
  });

  capabilities.register({
    name: "dehlero.ping",
    driver: "dehlero",
    action: "ping",
    description: "Check whether Dehlero runtime API is reachable.",
  });
}
