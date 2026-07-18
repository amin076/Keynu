import { strict as assert } from "node:assert";
import { RuntimeGraphIntelligence } from "../RuntimeGraphIntelligence.js";
import type { RuntimeGraphSnapshot } from "../RuntimeGraphIntelligence.js";

const intelligence = Object.create(
  RuntimeGraphIntelligence.prototype,
) as RuntimeGraphIntelligence;

const snapshot: RuntimeGraphSnapshot = {
  generatedAt: new Date().toISOString(),
  graphGeneratedAt: null,
  graphVersion: "test",
  graphProjectRoot: "C:/Physics/Keynu",
  graphSnapshotPath: ".keynu/graph/test.json",
  activeProjectId: "keynu",
  activeMissionId: "knowledge-graph-engine",
  missionStatus: "ACTIVE",
  currentMilestone: "Graph-driven runtime intelligence",
  lastJobId: "job-test-runtime-recommendations",
  runtimeState: "READY",
  nodeCount: 2,
  edgeCount: 0,
  nodesByType: { mission: 1, service: 1 },
  edgesByType: {},
  activeNodes: [
    {
      id: "knowledge-graph-engine",
      type: "mission",
      status: "ACTIVE",
    },
    {
      id: "failed-continuation-delivery",
      type: "runtime-service",
      status: "FAILED",
    },
  ],
  recentEdges: [],
  warnings: [],
};

const recommendations = intelligence.recommendNextActions(snapshot);

assert.equal(recommendations.length >= 2, true);
assert.equal(recommendations[0]?.priority, "CRITICAL");
assert.equal(
  recommendations.some(
    (item) => item.id === "recover-failed-continuation-delivery",
  ),
  true,
);
assert.equal(
  recommendations.some(
    (item) => item.id === "derive-next-action-knowledge-graph-engine",
  ),
  true,
);


assert.equal(
  recommendations.some((item) =>
    item.id.startsWith('restore-missing-mission-'),
  ),
  false,
  'A valid active mission from mission state must not be reported as missing.',
);
console.log("PASS RuntimeGraphIntelligenceRecommendations");
