import { CapabilityRegistry } from "./CapabilityRegistry.js";
import { DriverManager } from "./DriverManager.js";
import { BlenderDriver } from "../drivers/blender/BlenderDriver.js";
import { DehleroDriver } from "../drivers/dehlero/DehleroDriver.js";
import { FileSystemDriver } from "../drivers/filesystem/FileSystemDriver.js";
import { MelakatDriver } from "../drivers/melakat/MelakatDriver.js";
import { EngineeringDriver } from "../engineering/EngineeringDriver.js";

export async function registerBuiltinDrivers(
  manager: DriverManager,
  capabilities?: CapabilityRegistry,
): Promise<void> {
  // Keep the legacy filesystem driver registered for KAP 1.0 compatibility.
  // New software-development integrations should depend on the central
  // Engineering Runtime instead of duplicating filesystem/shell/Git logic.
  manager.register(new FileSystemDriver());
  manager.register(new EngineeringDriver());
  manager.register(new MelakatDriver());
  manager.register(new DehleroDriver());
  manager.register(new BlenderDriver());

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
    description: "Legacy compatibility capability: write a UTF-8 text file to disk.",
  });

  capabilities.register({
    name: "filesystem.readFile",
    driver: "filesystem",
    action: "readFile",
    description: "Legacy compatibility capability: read a UTF-8 text file from disk.",
  });

  const engineeringCapabilities = [
    ["engineering.fs.readFile", "fs.readFile", "Read a project-scoped UTF-8 text file."],
    ["engineering.fs.writeFile", "fs.writeFile", "Write a project-scoped UTF-8 text file."],
    ["engineering.fs.createFolder", "fs.createFolder", "Create a project-scoped directory."],
    ["engineering.fs.listDirectory", "fs.listDirectory", "List a project-scoped directory."],
    ["engineering.fs.exists", "fs.exists", "Check whether a project-scoped path exists."],
    ["engineering.command.run", "command.run", "Run a project-scoped development command."],
    ["engineering.script.run", "script.run", "Run a project-scoped Node/PowerShell/Python/Bash script."],
    ["engineering.git.status", "git.status", "Read Git status for a project repository."],
    ["engineering.git.currentBranch", "git.currentBranch", "Read the active Git branch."],
    ["engineering.git.diff", "git.diff", "Read a project Git diff."],
    ["engineering.git.log", "git.log", "Read recent project Git commits."],
    ["engineering.git.createBranch", "git.createBranch", "Create and switch to a local project branch."],
    ["engineering.git.switchBranch", "git.switchBranch", "Switch the local project branch."],
    ["engineering.git.stage", "git.stage", "Stage selected project paths."],
    ["engineering.git.commit", "git.commit", "Create a local Git commit from staged changes."],
    ["engineering.project.verify", "project.verify", "Run an ordered project build/test/verification command set."],
  ] as const;

  for (const [name, action, description] of engineeringCapabilities) {
    capabilities.register({
      name,
      driver: "engineering",
      action,
      description,
    });
  }

  const melakatCapabilities = [
    ["melakat.status", "status", "Inspect the configured Melakat project and experiment interface."],
    ["melakat.validateExperiment", "validateExperiment", "Validate a Melakat experiment specification through the repository CLI."],
    ["melakat.runExperiment", "runExperiment", "Run a controlled Melakat experiment campaign and require passing validation evidence."],
    ["melakat.readCampaign", "readCampaign", "Read the canonical Melakat campaign artifact."],
    ["melakat.readValidation", "readValidation", "Read and evaluate the canonical Melakat validation artifact."],
    ["melakat.compareConditions", "compareConditions", "Read baseline, condition, and comparison evidence from Melakat summary artifacts."],
    ["melakat.evidenceSummary", "evidenceSummary", "Build a compact evidence/checksum summary from canonical Melakat artifacts."],
    ["melakat.findExtinctions", "findExtinctions", "Identify runs whose recorded final active population is zero without inferring cause."],
    ["melakat.findAnomalies", "findAnomalies", "Identify canonical experimental-integrity inspection candidates without biological interpretation."],
  ] as const;

  for (const [name, action, description] of melakatCapabilities) {
    capabilities.register({
      name,
      driver: "melakat",
      action,
      description,
    });
  }

  capabilities.register({
    name: "dehlero.ping",
    driver: "dehlero",
    action: "ping",
    description: "Check whether Dehlero runtime API is reachable.",
  });

  capabilities.register({
    name: "dehlero.sendCommand",
    driver: "dehlero",
    action: "sendCommand",
    description: "Send a command payload to the Dehlero runtime API.",
  });

  capabilities.register({
    name: "blender.status",
    driver: "blender",
    action: "status",
    description: "Detect Blender executable and report Blender driver status.",
  });
}
