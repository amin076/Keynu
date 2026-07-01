import { DriverManager } from "./DriverManager.js";

import { FileSystemDriver } from "../drivers/filesystem/FileSystemDriver.js";
import { DehleroDriver } from "../drivers/dehlero/DehleroDriver.js";

export async function registerBuiltinDrivers(
  manager: DriverManager,
) {
  manager.register(new FileSystemDriver());

  manager.register(new DehleroDriver());

  await manager.initialize();
}