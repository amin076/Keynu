import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphSnapshotStore } from "../GraphSnapshotStore.js";
import { GraphEventStore } from "../GraphEventStore.js";
import { EffectiveGraphQueryService } from "../EffectiveGraphQueryService.js";
import {
  OperationalInsightsService,
  type OperationalInsight,
} from "../OperationalInsightsService.js";

const root = mkdtempSync(join(tmpdir(), "keynu-operational-insights-"));
const graphDir = join(root, ".keynu", "graph");
const snapshotPath = join(graphDir, "snapshot.json");
const eventPath = join(graphDir, "events.ndjson");
mkdirSync(graphDir, { recursive: true });

writeFileSync(
  snapshotPath,
  JSON.stringify(
    {
      version: "1.0",
      projectRoot: root,
      generatedAt: "2026-07-14T00:00:00.000Z",
      nodes: [
        {
          id: "file:src/a.ts",
          label: "a.ts",
          kind: "file",
          path: "src/a.ts",
          state: "idle"
        },
        {
          id: "file:src/b.ts",
          label: "b.ts",
          kind: "file",
          path: "src/b.ts",
          state: "idle"
        }
      ],
      edges: [
        {
          id: "file:src/b.ts->file:src/a.ts:imports",
          source: "file:src/b.ts",
          target: "file:src/a.ts",
          kind: "imports",
          state: "idle"
        }
      ]
    },
    null,
    2
  ),
  "utf8"
);

const events = [
  {
    id: "event-failed-job",
    time: "2026-07-14T00:01:00.000Z",
    jobId: "job-failed",
    type: "node.failed",
    nodeId: "runtime-step:job-failed",
    metadata: {
      phase: "failed",
      target: "powershell",
      workflowId: "recovery-test"
    }
  },
  {
    id: "event-read",
    time: "2026-07-14T00:02:00.000Z",
    jobId: "job-reader",
    driverId: "powershell",
    type: "node.success",
    nodeId: "runtime-step:job-reader:read:0",
    metadata: {
      category: "read",
      path: "src/a.ts"
    }
  }
];

writeFileSync(
  eventPath,
  events.map((event) => JSON.stringify(event)).join("\n") + "\n",
  "utf8"
);

const query = new EffectiveGraphQueryService(
  new GraphSnapshotStore(snapshotPath),
  new GraphEventStore(eventPath)
);

const service = new OperationalInsightsService(query);
const result = service.getSummary();

assert.equal(result.counts.failedJobs, 1);
assert.equal(result.counts.unresolvedFailedJobs, 1);
assert.equal(result.counts.recoveredFailedJobs, 0);
assert.equal(result.counts.activeJobs, 0);
assert.equal(result.counts.staleActiveJobs, 0);
assert.equal(result.frequentlyTouchedFiles[0].node.id, "file:src/a.ts");
assert.equal(result.frequentlyTouchedFiles[0].reads, 1);
assert.equal(result.highImpactFiles[0].node.id, "file:src/a.ts");
assert.equal(result.highImpactFiles[0].impactedNodeCount, 1);
assert(
  result.insights.some(
    (item: OperationalInsight) => item.category === "unresolved-failure"
  )
);
assert(
  result.insights.some(
    (item: OperationalInsight) => item.category === "frequently-touched-file"
  )
);
assert(
  result.insights.some(
    (item: OperationalInsight) => item.category === "high-impact-file"
  )
);


const recoveryEvents = [
  {
    id: "event-old-failed-job",
    time: "2026-07-14T00:03:00.000Z",
    jobId: "job-old-impact-query-001",
    type: "node.failed",
    nodeId: "runtime-step:job-old-impact-query-001",
    metadata: { phase: "failed" }
  },
  {
    id: "event-old-failed-command",
    time: "2026-07-14T00:03:01.000Z",
    jobId: "job-old-impact-query-001",
    type: "node.failed",
    nodeId: "runtime-step:job-old-impact-query-001:command:0",
    metadata: {
      category: "command",
      command: "node",
      error: "EffectiveGraphQueryService impact query assertion failed"
    }
  },
  {
    id: "event-new-success-job",
    time: "2026-07-14T00:04:00.000Z",
    jobId: "job-keynu-verify-graph-impact-api-999",
    type: "node.success",
    nodeId: "runtime-step:job-keynu-verify-graph-impact-api-999",
    metadata: { phase: "completed" }
  }
];

writeFileSync(
  eventPath,
  [...events, ...recoveryEvents].map((event) => JSON.stringify(event)).join("\n") + "\n",
  "utf8"
);

const refinedResult = service.getSummary();
assert(
  refinedResult.recoveredFailedJobs.some(
    (node) => node.label === "job-old-impact-query-001"
  )
);
assert(
  !refinedResult.unresolvedFailedJobs.some(
    (node) => node.label === "job-old-impact-query-001"
  )
);


const dashboardRecoveryEvents = [
  {
    id: "event-old-dashboard-failure",
    time: "2026-07-14T00:05:00.000Z",
    jobId: "job-old-dashboard-harness-001",
    type: "node.failed",
    nodeId: "runtime-step:job-old-dashboard-harness-001",
    metadata: { phase: "failed" }
  },
  {
    id: "event-old-dashboard-command",
    time: "2026-07-14T00:05:01.000Z",
    jobId: "job-old-dashboard-harness-001",
    type: "node.failed",
    nodeId: "runtime-step:job-old-dashboard-harness-001:command:0",
    metadata: {
      category: "command",
      command: "node",
      error: "Dashboard API test harness returned HTTP 404"
    }
  },
  {
    id: "event-new-dashboard-success",
    time: "2026-07-14T00:06:00.000Z",
    jobId: "job-keynu-verify-live-dashboard-api-999",
    type: "node.success",
    nodeId: "runtime-step:job-keynu-verify-live-dashboard-api-999",
    metadata: { phase: "completed" }
  }
];

writeFileSync(
  eventPath,
  [...events, ...recoveryEvents, ...dashboardRecoveryEvents]
    .map((event) => JSON.stringify(event))
    .join("\n") + "\n",
  "utf8"
);

const dashboardRefinedResult = service.getSummary();
assert(
  dashboardRefinedResult.recoveredFailedJobs.some(
    (node) => node.label === "job-old-dashboard-harness-001"
  )
);
assert(
  !dashboardRefinedResult.unresolvedFailedJobs.some(
    (node) => node.label === "job-old-dashboard-harness-001"
  )
);


const inconclusiveEvents = [
  {
    id: "event-inconclusive-job-failed",
    time: "2026-07-14T00:07:00.000Z",
    jobId: "job-inconclusive-history-001",
    type: "node.failed",
    nodeId: "runtime-step:job-inconclusive-history-001",
    metadata: { phase: "failed" }
  },
  {
    id: "event-inconclusive-command-success",
    time: "2026-07-14T00:07:01.000Z",
    jobId: "job-inconclusive-history-001",
    type: "node.success",
    nodeId: "runtime-step:job-inconclusive-history-001:command:0",
    metadata: { category: "command", command: "node" }
  },
  {
    id: "event-later-unrelated-success",
    time: "2026-07-14T00:08:00.000Z",
    jobId: "job-later-success-001",
    type: "node.success",
    nodeId: "runtime-step:job-later-success-001",
    metadata: { phase: "completed" }
  }
];

writeFileSync(
  eventPath,
  [...events, ...recoveryEvents, ...dashboardRecoveryEvents, ...inconclusiveEvents]
    .map((event) => JSON.stringify(event))
    .join("\n") + "\n",
  "utf8"
);

const inconclusiveResult = service.getSummary();
assert(
  inconclusiveResult.inconclusiveHistoricalFailures.some(
    (node) => node.label === "job-inconclusive-history-001"
  )
);
assert(
  !inconclusiveResult.unresolvedFailedJobs.some(
    (node) => node.label === "job-inconclusive-history-001"
  )
);
assert(
  inconclusiveResult.insights.some(
    (item: OperationalInsight) => item.category === "historical-failure"
  )
);

console.log("Operational insights service tests passed.");
