import { DriverManager } from "./DriverManager.js";
import { DehleroDriver } from "../drivers/dehlero/DehleroDriver.js";
import { FileSystemDriver } from "../drivers/filesystem/FileSystemDriver.js";

export async function registerBuiltinDrivers(
  manager: DriverManager,
): Promise<void> {
  manager.register(new FileSystemDriver());
  manager.register(new DehleroDriver());

  await manager.initialize();
}
