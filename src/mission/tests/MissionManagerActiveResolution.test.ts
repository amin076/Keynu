import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { ActiveMissionResolver } from "../ActiveMissionResolver.js";
import { BootstrapBuilder } from "../BootstrapBuilder.js";
import { ContextAssembler } from "../ContextAssembler.js";
import { ContextBudgeter } from "../ContextBudgeter.js";
import { MissionManager } from "../MissionManager.js";
import { MissionRegistry } from "../MissionRegistry.js";
import { MissionStateStore } from "../MissionStateStore.js";
import { MissionValidator } from "../MissionValidator.js";

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const root = mkdtempSync(join(tmpdir(), "keynu-manager-resolution-"));
const statePath = join(root, ".keynu", "missions", "state.json");

try {
  writeJson(join(root, ".keynu", "missions", "projects.json"), {
    version: "1.0",
    projects: [
      {
        id: "keynu",
        name: "Keynu",
        root: ".",
        activeMissionId: "current-mission",
      },
    ],
  });

  writeJson(join(root, ".keynu", "missions", "keynu", "current-mission.json"), {
    id: "current-mission",
    projectId: "keynu",
    title: "Current Mission",
    goal: "Verify central active mission resolution.",
    status: "ACTIVE",
    currentMilestone: "Current milestone",
    completedMilestones: [],
    nextMilestones: ["Next milestone"],
    rules: ["Configured mission is authoritative."],
    updatedAt: new Date().toISOString(),
  });

  writeJson(join(root, ".keynu", "missions", "keynu", "stale-mission.json"), {
    id: "stale-mission",
    projectId: "keynu",
    title: "Stale Mission",
    goal: "Old mission",
    status: "ACTIVE",
    currentMilestone: "Old milestone",
    completedMilestones: [],
    nextMilestones: ["Old next"],
    rules: ["Old rule"],
    updatedAt: new Date().toISOString(),
  });

  writeJson(statePath, {
    version: "1.0",
    activeProjectId: "keynu",
    activeMissionId: "stale-mission",
    missions: {
      "stale-mission": {
        missionId: "stale-mission",
        projectId: "keynu",
        status: "ACTIVE",
        currentMilestone: "Old milestone",
        updatedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  });

  const memoryRoot = join(root, ".keynu", "memory");
  mkdirSync(memoryRoot, { recursive: true });
  for (const name of [
    "current_state.md",
    "architecture.md",
    "decisions.md",
    "next_steps.md",
    "startup_prompt.md",
  ]) {
    writeFileSync(join(memoryRoot, name), `# ${name}\nfixture\n`, "utf8");
  }

  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "keynu-tests@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Keynu Tests"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });

  const registry = new MissionRegistry(root);
  const stateStore = new MissionStateStore(statePath);
  const resolver = new ActiveMissionResolver({ registry, stateStore });
  const assembler = new ContextAssembler(registry, stateStore, resolver);
  const budgeter = new ContextBudgeter();
  const validator = new MissionValidator();
  const builder = new BootstrapBuilder(assembler, budgeter, validator, stateStore);
  const manager = new MissionManager(
    registry,
    stateStore,
    assembler,
    budgeter,
    validator,
    builder,
    resolver,
  );

  const before = resolver.resolve();
  assert.equal(before.action, "REQUIRE_BOOTSTRAP");
  assert.equal(before.missionId, "current-mission");
  assert.equal(before.persistedActiveMissionId, "stale-mission");

  const context = manager.getContext();
  assert.equal(context.mission.id, "current-mission");
  assert.equal(context.project.id, "keynu");

  const bootstrap = manager.prepare();
  assert.equal(bootstrap.payload.missionId, "current-mission");
  assert.equal(stateStore.read().activeMissionId, "current-mission");
  assert.equal(resolver.resolve().action, "NONE");
  assert.equal(stateStore.getMission("stale-mission")?.missionId, "stale-mission");

  manager.recordJob("job-current");
  assert.equal(stateStore.getMission("current-mission")?.lastJobId, "job-current");
  assert.equal(stateStore.getMission("stale-mission")?.lastJobId, undefined);

  console.log("MissionManager active resolution integration tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
