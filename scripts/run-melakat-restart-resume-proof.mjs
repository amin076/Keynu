import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MelakatDriver } from "../dist/drivers/melakat/MelakatDriver.js";
import { PersistentJobStore } from "../dist/runtime/PersistentJobStore.js";
import { BrowserContinuationCoordinator } from "../dist/mission/BrowserContinuationCoordinator.js";
import { ContinuationStore } from "../dist/mission/ContinuationStore.js";
import { ContinuationDeliveryStore } from "../dist/mission/ContinuationDeliveryStore.js";
import { ContinuationDeliveryService } from "../dist/mission/ContinuationDeliveryService.js";

const projectRoot = resolve(
  process.env.MELAKAT_RESTART_PROJECT_ROOT || "../melakat",
);
const specPath =
  process.env.MELAKAT_RESTART_SPEC_PATH ||
  "experiments/phase-two/local-resource-energy-sweep.json";
const outputDir =
  process.env.MELAKAT_RESTART_OUTPUT_DIR ||
  "results/keynu-restart-resume-proof";
const ticks = Number(process.env.MELAKAT_RESTART_TICKS || "40");
const seedCount = Number(process.env.MELAKAT_RESTART_SEED_COUNT || "1");
const seedStart = Number(process.env.MELAKAT_RESTART_SEED_START || "1");

const missionId = "melakat-development";
const runJobId = "melakat-restart-proof-run-001";
const evidenceJobId = "melakat-restart-proof-evidence-001";
const stateRoot = mkdtempSync(join(tmpdir(), "keynu-melakat-restart-proof-"));
const continuationRoot = join(stateRoot, "continuations");
const deliveryRoot = join(stateRoot, "continuation-deliveries");
const driver = new MelakatDriver({ projectRoot });

let experimentExecutionCount = 0;

function makeCoordinator() {
  const continuationStore = new ContinuationStore({ rootDir: continuationRoot });
  const deliveryStore = new ContinuationDeliveryStore({ rootDir: deliveryRoot });
  const deliveryService = new ContinuationDeliveryService(deliveryStore);

  return new BrowserContinuationCoordinator({
    continuationStore,
    deliveryService,
    activeMissionResolver: {
      resolve() {
        return {
          action: "USE_CONFIGURED",
          projectId: "melakat",
          missionId,
          diagnostics: [],
        };
      },
    },
    missionStateStore: {
      getMission() {
        return null;
      },
    },
  });
}

async function executeRealExperiment() {
  experimentExecutionCount += 1;
  return await driver.execute({
    action: "runExperiment",
    payload: {
      specPath,
      outputDir,
      ticks,
      seedCount,
      seedStart,
      quiet: true,
      timeoutMs: 180_000,
    },
  });
}

try {
  // Process 1: claim and execute the real Melakat campaign exactly once.
  const process1Store = new PersistentJobStore(stateRoot);
  const firstClaim = await process1Store.claim(runJobId);
  assert.equal(firstClaim.created, true);
  await process1Store.set(runJobId, "RUNNING");

  const runResult = await executeRealExperiment();
  assert.equal(
    runResult.success,
    true,
    `Real Melakat experiment failed: ${JSON.stringify(runResult.data)}`,
  );

  const runData = runResult.data || {};
  assert.equal(runData.processPassed, true);
  assert.equal(runData.validationPassed, true);

  const persistedReport =
    "```kap\n" +
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${runJobId}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId: runJobId,
          status: "COMPLETED",
          result: {
            action: "melakat.runExperiment",
            outputDir,
            processPassed: runData.processPassed,
            validationPassed: runData.validationPassed,
            evidencePaths: runData.evidencePaths,
          },
        },
      },
      null,
      2,
    ) +
    "\n```";

  await process1Store.recordReport(
    runJobId,
    "COMPLETED",
    persistedReport,
    `report-${runJobId}`,
  );

  // Simulated crash boundary: the verified report is durable, but it has not
  // been marked delivered and no continuation has been sent yet.
  const beforeRestart = await process1Store.get(runJobId);
  assert(beforeRestart);
  assert.equal(beforeRestart.state, "COMPLETED");
  assert.equal(beforeRestart.reportDeliveredAt, undefined);
  assert.equal(experimentExecutionCount, 1);

  // Process 2: a fresh store instance sees the same job ID and must recover
  // the persisted report instead of running the experiment again.
  const process2Store = new PersistentJobStore(stateRoot);
  const restartClaim = await process2Store.claim(runJobId);
  assert.equal(restartClaim.created, false);
  assert.equal(restartClaim.record.state, "COMPLETED");
  assert.equal(restartClaim.record.reportText, persistedReport);
  assert.equal(experimentExecutionCount, 1);

  const recoveredReports = [];
  if (!restartClaim.record.reportDeliveredAt && restartClaim.record.reportText) {
    recoveredReports.push(restartClaim.record.reportText);
    await process2Store.markReportDelivered(runJobId);
  }
  assert.equal(recoveredReports.length, 1);

  const continuationMessages = [];
  const process2Coordinator = makeCoordinator();
  const continuation = await process2Coordinator.continueAfterReport(
    {
      missionId,
      missionTitle: "Melakat Autonomous Development and Research",
      jobId: runJobId,
      reportStatus: "COMPLETED",
      maxAutonomousSteps: 12,
    },
    async (message) => {
      continuationMessages.push(message);
    },
  );

  assert.equal(continuation.deliveryStatus, "DELIVERED");
  assert.equal(continuationMessages.length, 1);
  assert.match(
    continuationMessages[0],
    /select a new, distinct mission step\. Do not repeat the completed action\./,
  );
  assert.match(
    continuationMessages[0],
    /Required Next Action: evaluate_completed_job_and_select_next_distinct_mission_step/,
  );
  assert.equal(experimentExecutionCount, 1);

  // The next KAP job is deliberately distinct and read-only: inspect the
  // canonical evidence produced by the completed experiment.
  const evidenceClaim = await process2Store.claim(evidenceJobId);
  assert.equal(evidenceClaim.created, true);
  await process2Store.set(evidenceJobId, "RUNNING");
  const evidenceResult = await driver.execute({
    action: "evidenceSummary",
    payload: { outputDir },
  });
  assert.equal(evidenceResult.success, true);
  const evidenceData = evidenceResult.data || {};
  assert.equal(evidenceData.validationPassed, true);

  const evidenceReport =
    "```kap\n" +
    JSON.stringify(
      {
        protocol: "KAP",
        version: "1.0",
        type: "REPORT",
        id: `report-${evidenceJobId}`,
        createdAt: new Date().toISOString(),
        payload: {
          jobId: evidenceJobId,
          status: "COMPLETED",
          result: evidenceData,
        },
      },
      null,
      2,
    ) +
    "\n```";
  await process2Store.recordReport(
    evidenceJobId,
    "COMPLETED",
    evidenceReport,
    `report-${evidenceJobId}`,
  );
  await process2Store.markReportDelivered(evidenceJobId);
  assert.equal(experimentExecutionCount, 1);

  // Process 3: another restart still must not replay the original campaign,
  // and the same continuation request must be suppressed as a duplicate.
  const process3Store = new PersistentJobStore(stateRoot);
  const thirdClaim = await process3Store.claim(runJobId);
  assert.equal(thirdClaim.created, false);
  assert.equal(thirdClaim.record.state, "COMPLETED");
  assert.ok(thirdClaim.record.reportDeliveredAt);

  const duplicateContinuationMessages = [];
  const process3Coordinator = makeCoordinator();
  const duplicateContinuation = await process3Coordinator.continueAfterReport(
    {
      missionId,
      missionTitle: "Melakat Autonomous Development and Research",
      jobId: runJobId,
      reportStatus: "COMPLETED",
      maxAutonomousSteps: 12,
    },
    async (message) => {
      duplicateContinuationMessages.push(message);
    },
  );

  assert.equal(duplicateContinuation.deliveryStatus, "SKIPPED_DUPLICATE");
  assert.equal(duplicateContinuationMessages.length, 0);
  assert.equal(experimentExecutionCount, 1);

  const finalRunRecord = await process3Store.get(runJobId);
  const finalEvidenceRecord = await process3Store.get(evidenceJobId);
  const persistedContinuation = new ContinuationStore({
    rootDir: continuationRoot,
  }).read(missionId);

  assert(finalRunRecord);
  assert(finalEvidenceRecord);
  assert(persistedContinuation);
  assert.equal(persistedContinuation.jobId, runJobId);
  assert.equal(persistedContinuation.autonomousStepCount, 1);

  const proof = {
    kind: "keynu-melakat-restart-resume-proof",
    scientificClaim: false,
    purpose:
      "Runtime-safety proof only: a completed real Melakat experiment is persisted, recovered after restart, never replayed for the same KAP job ID, and followed by a distinct evidence-read job.",
    projectRoot,
    specPath,
    outputDir,
    ticks,
    seedCount,
    seedStart,
    missionId,
    runJobId,
    evidenceJobId,
    experimentExecutionCount,
    originalJobReexecuted: experimentExecutionCount !== 1,
    reportPersistedBeforeCrash: true,
    recoveredUndeliveredReportAfterRestart: recoveredReports.length === 1,
    continuationDeliveryStatus: continuation.deliveryStatus,
    duplicateContinuationDeliveryStatus: duplicateContinuation.deliveryStatus,
    continuationMessageCount: continuationMessages.length,
    duplicateContinuationMessageCount: duplicateContinuationMessages.length,
    distinctNextAction: "melakat.evidenceSummary",
    distinctNextActionSucceeded: evidenceResult.success,
    validationPassed: evidenceData.validationPassed === true,
    failureCount: evidenceData.failureCount ?? null,
    reproducibilityIdentical: evidenceData.reproducibilityIdentical ?? null,
    evidenceChecksumCount: evidenceData.evidenceChecksumCount ?? null,
    persistedAutonomousStepCount: persistedContinuation.autonomousStepCount,
    originalJobState: finalRunRecord.state,
    evidenceJobState: finalEvidenceRecord.state,
  };

  console.log(JSON.stringify(proof, null, 2));
  console.log("Melakat restart-resume proof passed.");
} finally {
  rmSync(stateRoot, { recursive: true, force: true });
}
