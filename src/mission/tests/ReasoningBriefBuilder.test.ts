import assert from "node:assert/strict";
import { ReasoningBriefBuilder } from "../ReasoningBriefBuilder.js";
import type { MissionContext } from "../MissionTypes.js";

const context: MissionContext = {
  project: { id: "claimflow", name: "ClaimFlow", root: "/tmp/claimflow" },
  mission: {
    id: "release-readiness",
    projectId: "claimflow",
    title: "Prepare extraction pipeline for release",
    goal: "Verify extraction and fix only evidence-backed failures.",
    status: "ACTIVE",
    currentMilestone: "validation",
    completedMilestones: ["inspect"],
    nextMilestones: ["validate"],
    rules: Array.from({ length: 20 }, (_, i) => `rule-${i}`),
    updatedAt: new Date(0).toISOString(),
  },
  memory: [{
    name: "current_state.md",
    path: "/tmp/current_state.md",
    exists: true,
    content: "x".repeat(50000),
  }],
  repository: {
    root: "/tmp/claimflow",
    branch: "main",
    changedFiles: Array.from({ length: 100 }, (_, i) => `src/file-${i}.ts`),
    packageScripts: { build: "tsc", test: "node tests.js" },
    drivers: Array.from({ length: 50 }, (_, i) => `driver-${i}`),
    capabilities: Array.from({ length: 50 }, (_, i) => `cap-${i}`),
    lastJobId: "job-17",
    lastReportStatus: "FAILED",
    graphSnapshotAvailable: true,
    inspectedAt: new Date(0).toISOString(),
  },
  openTasks: ["validate"],
  continuation: {
    currentMilestone: "validation",
    pendingMilestones: ["validate"],
    architectureDecisions: [],
    recommendedReading: [],
    knownLimitations: [],
    nextActions: Array.from({ length: 20 }, (_, i) => ({
      priority: i + 1,
      title: `action-${i}`,
      reason: "targeted next step",
    })),
  },
  rules: Array.from({ length: 20 }, (_, i) => `rule-${i}`),
  warnings: Array.from({ length: 20 }, (_, i) => `warning-${i}`),
  generatedAt: new Date(0).toISOString(),
};

const builder = new ReasoningBriefBuilder({
  maximumCharacters: 4000,
  maximumChangedFiles: 5,
  maximumNextActions: 3,
});
const brief = builder.build(context);

assert.equal(brief.purpose, "TARGETED_REASONING");
assert.equal(brief.executionState.changedFiles.length, 5);
assert.equal(brief.nextActions.length, 3);
assert.equal(brief.budget.truncated, true);
assert.ok(brief.budget.estimatedCharacters <= 4000);
assert.ok(!builder.buildMessage(context).includes("x".repeat(100)));
assert.ok(!("memory" in brief));
assert.ok(!("packageScripts" in brief.executionState));

console.log("ReasoningBriefBuilder tests passed");
