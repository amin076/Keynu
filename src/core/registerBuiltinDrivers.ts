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
  });

  capabilities.register({
    name: "filesystem.readFile",
    driver: "filesystem",
    action: "readFile",
  });

  capabilities.register({
    name: "dehlero.sendCommand",
    driver: "dehlero",
    action: "sendCommand",
  });
}
