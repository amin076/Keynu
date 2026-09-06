import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { MelakatDriver } from "../dist/drivers/melakat/MelakatDriver.js";

const projectRoot = resolve(
  process.env.MELAKAT_SMOKE_PROJECT_ROOT || "../melakat",
);
const specPath =
  process.env.MELAKAT_SMOKE_SPEC_PATH ||
  "experiments/phase-two/local-resource-energy-sweep.json";
const outputDir =
  process.env.MELAKAT_SMOKE_OUTPUT_DIR ||
  "results/keynu-integration-smoke";
const ticks = Number(process.env.MELAKAT_SMOKE_TICKS || "40");
const seedCount = Number(process.env.MELAKAT_SMOKE_SEED_COUNT || "1");
const seedStart = Number(process.env.MELAKAT_SMOKE_SEED_START || "1");

const driver = new MelakatDriver({ projectRoot });

const status = await driver.execute({ action: "status" });
assert.equal(
  status.success,
  true,
  `Melakat status failed: ${JSON.stringify(status.data)}`,
);

const validate = await driver.execute({
  action: "validateExperiment",
  payload: {
    specPath,
    ticks,
    seedCount,
    seedStart,
  },
});
assert.equal(
  validate.success,
  true,
  `Melakat experiment validation failed: ${JSON.stringify(validate.data)}`,
);

const run = await driver.execute({
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
assert.equal(
  run.success,
  true,
  `Melakat campaign failed: ${JSON.stringify(run.data)}`,
);

const validation = await driver.execute({
  action: "readValidation",
  payload: { outputDir },
});
assert.equal(
  validation.success,
  true,
  `Melakat validation artifact failed: ${JSON.stringify(validation.data)}`,
);

const campaign = await driver.execute({
  action: "readCampaign",
  payload: { outputDir },
});
assert.equal(campaign.success, true);

const comparison = await driver.execute({
  action: "compareConditions",
  payload: { outputDir },
});
assert.equal(comparison.success, true);

const evidenceSummary = await driver.execute({
  action: "evidenceSummary",
  payload: { outputDir },
});
assert.equal(
  evidenceSummary.success,
  true,
  `Melakat evidence summary failed: ${JSON.stringify(evidenceSummary.data)}`,
);

const extinctions = await driver.execute({
  action: "findExtinctions",
  payload: { outputDir },
});
assert.equal(extinctions.success, true);

const anomalies = await driver.execute({
  action: "findAnomalies",
  payload: { outputDir },
});
assert.equal(anomalies.success, true);

const campaignData = campaign.data?.campaign || {};
const validationData = validation.data?.validation || {};
const comparisonData = comparison.data || {};
const compactEvidence = evidenceSummary.data?.evidence || {};
const extinctionData = extinctions.data || {};
const anomalyData = anomalies.data || {};
const runs = Array.isArray(campaignData.runs) ? campaignData.runs : [];
const conditions = Array.isArray(comparisonData.conditions)
  ? comparisonData.conditions
  : [];
const comparisons = Array.isArray(comparisonData.comparisons)
  ? comparisonData.comparisons
  : [];
const evidenceChecksums = compactEvidence.checksums || {};

assert.equal(validationData.passed, true);
assert.equal(compactEvidence.validation?.passed, true);
assert.equal(anomalyData.integrityPassed, true);
assert.equal(anomalyData.candidateCount, 0);
assert(runs.length >= 1, "Smoke campaign returned no runs.");
assert(conditions.length >= 1, "Smoke campaign returned no condition summaries.");
assert(
  Object.keys(evidenceChecksums).length >= 6,
  "Smoke evidence summary did not parse the expected checksum manifest.",
);
assert.equal(typeof extinctionData.extinctionCount, "number");

const evidence = {
  kind: "melakat-keynu-cross-repo-smoke",
  scientificClaim: false,
  purpose:
    "Integration smoke only: prove Keynu can invoke the real Melakat runner and read canonical artifacts.",
  projectRoot,
  specPath,
  outputDir,
  ticks,
  seedCount,
  seedStart,
  experiment: campaignData.experiment ?? null,
  runCount: runs.length,
  validationPassed: validationData.passed === true,
  failureCount: validationData.failure_count ?? null,
  reproducibility: validationData.reproducibility ?? null,
  baselineCondition: comparisonData.baselineCondition ?? null,
  conditionCount: conditions.length,
  comparisonCount: comparisons.length,
  evidenceChecksumCount: Object.keys(evidenceChecksums).length,
  extinctionCount: extinctionData.extinctionCount,
  integrityCandidateCount: anomalyData.candidateCount,
  driverCli: status.data?.cli ?? null,
};

console.log(JSON.stringify(evidence, null, 2));
console.log("Melakat cross-repository integration smoke passed.");
