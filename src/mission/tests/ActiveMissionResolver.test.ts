import { strict as assert } from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { ActiveMissionResolver } from "../ActiveMissionResolver.js";
import { MissionRegistry } from "../MissionRegistry.js";
import {
  MissionStateStore,
  type MissionStateStoreData,
} from "../MissionStateStore.js";
import type { MissionDefinition } from "../MissionTypes.js";

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createRoot(): string {
  return mkdtempSync(join(tmpdir(), "keynu-active-mission-resolver-"));
}

function writeRegistry(root: string, missionId: string): void {
  writeJson(join(root, ".keynu", "missions", "projects.json"), {
    version: "1.0",
    projects: [
      {
        id: "keynu",
        name: "Keynu",
        root: ".",
        activeMissionId: missionId,
      },
    ],
  });
}

function createMission(id: string): MissionDefinition {
  return {
    id,
    projectId: "keynu",
    title: id === "openai-build-week" ? "OpenAI Build Week" : "React Dashboard",
    goal: "Test mission",
    status: "ACTIVE",
    currentMilestone:
      id === "openai-build-week"
        ? "Prepare Build Week submission"
        : "Build React Mission Control",
    completedMilestones: [],
    nextMilestones: ["Next test milestone"],
    rules: ["Use isolated tests."],
    updatedAt: "2026-07-18T00:00:00.000Z",
  };
}

function writeMission(root: string, mission: MissionDefinition): void {
  writeJson(
    join(root, ".keynu", "missions", "keynu", `${mission.id}.json`),
    mission,
  );
}

function writeState(
  root: string,
  activeMissionId: string,
  activeProjectId = "keynu",
): void {
  const state: MissionStateStoreData = {
    version: "1.0",
    activeProjectId,
    activeMissionId,
    missions: {
      [activeMissionId]: {
        missionId: activeMissionId,
        projectId: activeProjectId,
        status: "ACTIVE",
        currentMilestone: "Persisted milestone",
        updatedAt: "2026-07-18T00:00:00.000Z",
      },
    },
    updatedAt: "2026-07-18T00:00:00.000Z",
  };

  writeJson(join(root, ".keynu", "missions", "state.json"), state);
}

function writeStateWithMissions(
  root: string,
  state: MissionStateStoreData,
): void {
  writeJson(join(root, ".keynu", "missions", "state.json"), state);
}

function createResolver(root: string): ActiveMissionResolver {
  return new ActiveMissionResolver({
    registry: new MissionRegistry(root),
    stateStore: new MissionStateStore(
      join(root, ".keynu", "missions", "state.json"),
    ),
  });
}

function withRoot(test: (root: string) => void): void {
  const root = createRoot();

  try {
    test(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

withRoot((root) => {
  writeRegistry(root, "openai-build-week");
  writeMission(root, createMission("openai-build-week"));
  writeState(root, "openai-build-week");

  const resolution = createResolver(root).resolve();

  assert.equal(resolution.projectId, "keynu");
  assert.equal(resolution.missionId, "openai-build-week");
  assert.equal(resolution.action, "NONE");
  assert.deepEqual(resolution.reasons, ["CONFIG_AND_STATE_MATCH"]);
  assert.equal(resolution.stateMismatch, false);
  assert.equal(resolution.requiresBootstrap, false);
  assert.match(resolution.diagnostics.join("\n"), /match/);
});

withRoot((root) => {
  writeRegistry(root, "openai-build-week");
  writeMission(root, createMission("openai-build-week"));

  const resolution = createResolver(root).resolve();

  assert.equal(resolution.missionId, "openai-build-week");
  assert.equal(resolution.action, "RECONCILE_STATE");
  assert.deepEqual(resolution.reasons, ["PERSISTED_STATE_MISSING"]);
  assert.equal(resolution.stateMismatch, true);
  assert.equal(resolution.requiresBootstrap, true);
});

withRoot((root) => {
  writeRegistry(root, "openai-build-week");
  writeMission(root, createMission("openai-build-week"));
  writeMission(root, createMission("react-mission-control-dashboard"));
  writeState(root, "react-mission-control-dashboard");

  const resolution = createResolver(root).resolve();

  assert.equal(resolution.missionId, "openai-build-week");
  assert.equal(resolution.persistedActiveMissionId, "react-mission-control-dashboard");
  assert.equal(resolution.action, "REQUIRE_BOOTSTRAP");
  assert.deepEqual(resolution.reasons, [
    "PERSISTED_ACTIVE_MISSION_MISMATCH",
  ]);
  assert.equal(resolution.stateMismatch, true);
  assert.equal(resolution.requiresBootstrap, true);
  assert.match(
    resolution.diagnostics.join("\n"),
    /differs from persisted active mission/,
  );
});

withRoot((root) => {
  writeRegistry(root, "openai-build-week");

  const resolution = createResolver(root).resolve();

  assert.equal(resolution.action, "BLOCKED");
  assert.deepEqual(resolution.reasons, ["MISSION_DEFINITION_MISSING"]);
  assert.equal(resolution.requiresBootstrap, false);
  assert.match(resolution.diagnostics.join("\n"), /Mission definition not found/);
});

withRoot((root) => {
  writeJson(join(root, ".keynu", "missions", "projects.json"), {
    version: "broken",
    projects: [],
  });

  const resolution = createResolver(root).resolve();

  assert.equal(resolution.action, "BLOCKED");
  assert.deepEqual(resolution.reasons, ["REGISTRY_INVALID"]);
  assert.equal(resolution.requiresBootstrap, false);
  assert.match(resolution.diagnostics.join("\n"), /Mission registry is invalid/);
});

withRoot((root) => {
  writeRegistry(root, "openai-build-week");
  writeMission(root, createMission("openai-build-week"));
  writeMission(root, createMission("react-mission-control-dashboard"));
  writeStateWithMissions(root, {
    version: "1.0",
    activeProjectId: "keynu",
    activeMissionId: "react-mission-control-dashboard",
    missions: {
      "react-mission-control-dashboard": {
        missionId: "react-mission-control-dashboard",
        projectId: "keynu",
        status: "ACTIVE",
        currentMilestone: "Build React Mission Control",
        updatedAt: "2026-07-18T00:00:00.000Z",
      },
      "previous-mission": {
        missionId: "previous-mission",
        projectId: "keynu",
        status: "COMPLETED",
        currentMilestone: "Archived milestone",
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    },
    updatedAt: "2026-07-18T00:00:00.000Z",
  });

  const resolver = createResolver(root);
  const plan = resolver.buildReconciliationPlan();
  const stateStore = new MissionStateStore(
    join(root, ".keynu", "missions", "state.json"),
  );

  assert.equal(plan.shouldReconcileState, true);
  assert.equal(plan.missionId, "openai-build-week");
  assert.equal(stateStore.read().activeMissionId, "react-mission-control-dashboard");

  const result = resolver.reconcile();
  const reconciledState = stateStore.read();

  assert.equal(result.stateChanged, true);
  assert.equal(result.resolution.action, "NONE");
  assert.equal(reconciledState.activeMissionId, "openai-build-week");
  assert.equal(reconciledState.missions["react-mission-control-dashboard"]?.missionId, "react-mission-control-dashboard");
  assert.equal(reconciledState.missions["previous-mission"]?.status, "COMPLETED");
});

withRoot((root) => {
  writeRegistry(root, "openai-build-week");
  writeMission(root, createMission("openai-build-week"));
  writeState(root, "react-mission-control-dashboard");

  const resolver = createResolver(root);
  const firstResult = resolver.reconcile();
  const secondResult = resolver.reconcile();

  assert.equal(firstResult.stateChanged, true);
  assert.equal(secondResult.stateChanged, false);
  assert.equal(secondResult.resolution.action, "NONE");
  assert.equal(secondResult.plan.shouldReconcileState, false);
});

console.log("PASS ActiveMissionResolver");
