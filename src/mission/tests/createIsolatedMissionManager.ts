import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionRegistry } from "../MissionRegistry.js";
import { MissionStateStore } from "../MissionStateStore.js";
import { ContextAssembler } from "../ContextAssembler.js";
import { ContextBudgeter } from "../ContextBudgeter.js";
import { MissionValidator } from "../MissionValidator.js";
import { BootstrapBuilder } from "../BootstrapBuilder.js";
import { MissionManager } from "../MissionManager.js";

export type IsolatedMissionManagerFixture = {
  root: string;
  manager: MissionManager;
  dispose(): void;
};

function runGit(root: string, args: string[]): void {
  execFileSync("git", args, {
    cwd: root,
    stdio: "ignore",
  });
}

export function createIsolatedMissionManager(): IsolatedMissionManagerFixture {
  const root = mkdtempSync(join(tmpdir(), "keynu-mission-test-"));

  mkdirSync(join(root, "config"), { recursive: true });
  cpSync(
    join(process.cwd(), "config", "missions"),
    join(root, "config", "missions"),
    { recursive: true },
  );
  cpSync(
    join(process.cwd(), ".keynu", "missions"),
    join(root, ".keynu", "missions"),
    { recursive: true },
  );
  cpSync(
    join(process.cwd(), ".keynu", "memory"),
    join(root, ".keynu", "memory"),
    { recursive: true },
  );

  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "keynu-mission-test", version: "1.0.0" }, null, 2),
    "utf8",
  );

  runGit(root, ["init"]);
  runGit(root, ["checkout", "-b", "test-mission-fixture"]);
  runGit(root, ["config", "user.email", "keynu-tests@example.invalid"]);
  runGit(root, ["config", "user.name", "Keynu Tests"]);
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "Create isolated mission fixture"]);

  const registry = new MissionRegistry(root);
  const stateStore = new MissionStateStore(
    join(root, ".keynu", "missions", "state.json"),
  );
  const assembler = new ContextAssembler(registry, stateStore);
  const budgeter = new ContextBudgeter();
  const validator = new MissionValidator();
  const builder = new BootstrapBuilder(
    assembler,
    budgeter,
    validator,
    stateStore,
  );
  const manager = new MissionManager(
    registry,
    stateStore,
    assembler,
    budgeter,
    validator,
    builder,
  );

  return {
    root,
    manager,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}
