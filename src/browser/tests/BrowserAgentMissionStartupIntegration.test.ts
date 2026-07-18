import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ActiveMissionResolver } from "../../mission/ActiveMissionResolver.js";
import { MissionRegistry } from "../../mission/MissionRegistry.js";
import {
  MissionStateStore,
  type MissionStateStoreData,
} from "../../mission/MissionStateStore.js";
import type {
  MissionAckPayload,
  MissionBootstrapPayload,
  MissionDefinition,
} from "../../mission/MissionTypes.js";
import { SessionStore } from "../../session/index.js";
import {
  BrowserAgentApp,
  type BrowserAgentLifecycle,
  type BrowserDriverLifecycle,
  type BrowserConversationTransport,
} from "../BrowserAgentApp.js";
import { createMissionAcknowledgementSessionPatch } from "../BrowserAgent.js";

const conversationUrl = "https://chatgpt.com/c/build-week";
const fixedNow = new Date("2026-07-18T07:20:00.000Z");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createRoot(): string {
  return mkdtempSync(join(tmpdir(), "keynu-browser-agent-mission-"));
}

function withRoot(test: (root: string) => Promise<void> | void): Promise<void> {
  const root = createRoot();

  return Promise.resolve()
    .then(() => test(root))
    .finally(() => {
      rmSync(root, { recursive: true, force: true });
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
    nextMilestones: ["Next verified step"],
    rules: ["Use isolated tests."],
    updatedAt: fixedNow.toISOString(),
  };
}

function writeMissionFixture(root: string): void {
  writeJson(join(root, ".keynu", "missions", "projects.json"), {
    version: "1.0",
    projects: [
      {
        id: "keynu",
        name: "Keynu",
        root,
        activeMissionId: "openai-build-week",
      },
    ],
  });
  writeJson(
    join(root, ".keynu", "missions", "keynu", "openai-build-week.json"),
    createMission("openai-build-week"),
  );
  writeJson(
    join(
      root,
      ".keynu",
      "missions",
      "keynu",
      "react-mission-control-dashboard.json",
    ),
    createMission("react-mission-control-dashboard"),
  );
  writeJson(join(root, ".keynu", "missions", "state.json"), {
    version: "1.0",
    activeProjectId: "keynu",
    activeMissionId: "react-mission-control-dashboard",
    missions: {
      "react-mission-control-dashboard": {
        missionId: "react-mission-control-dashboard",
        projectId: "keynu",
        status: "ACTIVE",
        currentMilestone: "Build React Mission Control",
        updatedAt: fixedNow.toISOString(),
      },
    },
    updatedAt: fixedNow.toISOString(),
  } satisfies MissionStateStoreData);
  writeJson(join(root, ".keynu", "session", "session.json"), {
    version: 1,
    conversationUrl,
    memoryRestored: true,
    runtimeState: "idle",
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
  });
}

function createBootstrapPayload(
  bootstrapId: string,
  memoryRevision: string,
): MissionBootstrapPayload {
  return {
    protocol: "KAP",
    version: "1.0",
    type: "MISSION_BOOTSTRAP",
    id: bootstrapId,
    createdAt: fixedNow.toISOString(),
    payload: {
      projectId: "keynu",
      missionId: "openai-build-week",
      bootstrapId,
      memoryRevision,
      context: {} as MissionBootstrapPayload["payload"]["context"],
      validation: {
        status: "READY",
        checks: [],
        warnings: [],
      },
      protocolGuide: {
        name: "Keynu Agent Protocol",
        abbreviation: "KAP",
        version: "1.0",
        purpose: "Test protocol guide",
        documentPath: "docs/KAP/KAP_PROTOCOL_V1.md",
        transportFormat: "fenced-kap-json",
        mandatoryRules: [],
      },
      requiredResponse: {
        type: "MISSION_ACK",
        format: "fenced-kap-json",
        requiredFields: [],
        example: {} as MissionAckPayload,
      },
    },
  };
}

await withRoot(async (root) => {
  writeMissionFixture(root);

  const events: string[] = [];
  const sentMessages: string[] = [];
  const stateStore = new MissionStateStore(
    join(root, ".keynu", "missions", "state.json"),
  );
  const sessionStore = new SessionStore(root);
  const resolver = new ActiveMissionResolver({
    registry: new MissionRegistry(root),
    stateStore,
  });
  let prepareCalls = 0;

  const browser: BrowserDriverLifecycle = {
    async initialize() {
      events.push("browser.initialize");
    },
    getConversation(): BrowserConversationTransport {
      return {
        async sendMessage(message: string) {
          events.push("bootstrap.send");
          sentMessages.push(message);
        },
      };
    },
  };
  const agent: BrowserAgentLifecycle = {
    async seedWatcherBaseline() {
      events.push("agent.seed");
    },
    async start() {
      events.push("agent.start");
    },
  };
  const app = new BrowserAgentApp(
    { conversationUrl },
    {
      sessionStore,
      activeMissionResolver: resolver,
      createRuntime: () => ({} as never),
      createBrowserDriver: () => browser,
      createBrowserAgent: () => agent,
      now: () => fixedNow,
      missionManager: {
        prepare(options) {
          events.push("mission.prepare");
          prepareCalls += 1;
          assert.equal(options?.projectId, "keynu");
          assert.equal(options?.conversationUrl, conversationUrl);
          assert.equal(stateStore.read().activeMissionId, "openai-build-week");
          return createBootstrapPayload(
            "mission-bootstrap-keynu-openai-build-week-1",
            "revision-openai-build-week-1",
          );
        },
      },
    },
  );

  await app.start();

  const reconciledState = stateStore.read();
  const sessionAfterFirstStart = sessionStore.read();

  assert.equal(reconciledState.activeMissionId, "openai-build-week");
  assert.equal(
    reconciledState.missions["react-mission-control-dashboard"]?.missionId,
    "react-mission-control-dashboard",
  );
  assert.equal(prepareCalls, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /MISSION_BOOTSTRAP/);
  assert.match(sentMessages[0], /openai-build-week/);
  assert.equal(sessionAfterFirstStart.memoryRestored, false);
  assert.equal(sessionAfterFirstStart.missionProjectId, "keynu");
  assert.equal(sessionAfterFirstStart.missionId, "openai-build-week");
  assert.equal(
    sessionAfterFirstStart.missionBootstrapId,
    "mission-bootstrap-keynu-openai-build-week-1",
  );
  assert.equal(
    sessionAfterFirstStart.missionMemoryRevision,
    "revision-openai-build-week-1",
  );
  assert.equal(
    sessionAfterFirstStart.missionRestorationStaleReason,
    "MISSION_RECONCILIATION_REQUIRED",
  );
  assert.deepEqual(events, [
    "browser.initialize",
    "agent.seed",
    "mission.prepare",
    "bootstrap.send",
    "agent.start",
  ]);

  const secondApp = new BrowserAgentApp(
    { conversationUrl },
    {
      sessionStore,
      activeMissionResolver: resolver,
      createRuntime: () => ({} as never),
      createBrowserDriver: () => browser,
      createBrowserAgent: () => agent,
      now: () => fixedNow,
      missionManager: {
        prepare() {
          throw new Error("Second startup must not duplicate bootstrap.");
        },
      },
    },
  );

  await secondApp.start();

  assert.equal(prepareCalls, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(stateStore.read().activeMissionId, "openai-build-week");
});

await withRoot(async (root) => {
  writeJson(join(root, ".keynu", "session", "session.json"), {
    version: 1,
    conversationUrl,
    memoryRestored: false,
    runtimeState: "idle",
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
  });

  const ack: MissionAckPayload = {
    protocol: "KAP",
    version: "1.0",
    type: "MISSION_ACK",
    id: "mission-ack-openai-build-week",
    createdAt: fixedNow.toISOString(),
    payload: {
      projectId: "keynu",
      missionId: "openai-build-week",
      acknowledgedBootstrapId: "mission-bootstrap-keynu-openai-build-week-1",
      acknowledgedMemoryRevision: "revision-openai-build-week-1",
      status: "ACCEPTED",
      understoodMilestone: "Prepare Build Week submission",
    },
  };
  const sessionStore = new SessionStore(root);

  sessionStore.patch(
    createMissionAcknowledgementSessionPatch(
      ack,
      "2026-07-18T07:25:00.000Z",
    ),
  );

  const session = sessionStore.read();

  assert.equal(session.memoryRestored, true);
  assert.equal(session.missionProjectId, "keynu");
  assert.equal(session.missionId, "openai-build-week");
  assert.equal(
    session.missionBootstrapId,
    "mission-bootstrap-keynu-openai-build-week-1",
  );
  assert.equal(session.missionMemoryRevision, "revision-openai-build-week-1");
  assert.equal(session.missionAcknowledgedAt, "2026-07-18T07:25:00.000Z");
  assert.equal(session.missionRestorationStaleReason, undefined);
});

console.log("BrowserAgent mission startup integration tests passed.");
