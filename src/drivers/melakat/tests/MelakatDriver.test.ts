import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import type {
  EngineeringAction,
  EngineeringOperationResult,
  EngineeringPayload,
} from "../../../engineering/EngineeringTypes.js";
import { MelakatDriver } from "../MelakatDriver.js";

class FakeEngineeringRuntime {
  readonly calls: Array<{ action: EngineeringAction; payload: EngineeringPayload }> = [];
  readonly existing = new Set<string>();
  readonly files = new Map<string, string>();
  commandSuccess = true;

  async execute(
    action: EngineeringAction,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult> {
    this.calls.push({ action, payload });

    if (action === "fs.exists") {
      const exists = this.existing.has(String(payload.path));
      return {
        action,
        projectRoot: payload.projectRoot,
        success: true,
        summary: "Path checked.",
        data: { exists },
      };
    }

    if (action === "fs.readFile") {
      const path = String(payload.path);
      if (!this.files.has(path)) {
        throw new Error(`ENOENT:${path}`);
      }
      return {
        action,
        projectRoot: payload.projectRoot,
        success: true,
        summary: "File read successfully.",
        data: { content: this.files.get(path) },
      };
    }

    if (action === "command.run") {
      return {
        action,
        projectRoot: payload.projectRoot,
        success: this.commandSuccess,
        summary: this.commandSuccess
          ? "Command completed successfully."
          : "Command failed.",
        data: { ok: this.commandSuccess },
      };
    }

    throw new Error(`Unexpected fake Engineering Runtime action: ${action}`);
  }
}

const root = resolve("/tmp/keynu-melakat-driver-fixture");

{
  const runtime = new FakeEngineeringRuntime();
  runtime.existing.add("desktop/pyproject.toml");
  runtime.existing.add("desktop/src/melakat_desktop/experiment_runner.py");
  runtime.existing.add("desktop/.venv/bin/melakat-experiment");
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  assert.deepEqual(driver.capabilities, [
    "status",
    "validateExperiment",
    "runExperiment",
    "readCampaign",
    "readValidation",
    "compareConditions",
    "evidenceSummary",
    "findExtinctions",
    "findAnomalies",
  ]);

  const status = await driver.execute({ action: "status" });
  assert.equal(status.success, true);
  const statusData = status.data as any;
  assert.equal(statusData.ready, true);
  assert.equal(statusData.cli.source, "venv-posix");
  assert.equal(
    statusData.cli.command,
    resolve(root, "desktop/.venv/bin/melakat-experiment"),
  );
}

{
  const runtime = new FakeEngineeringRuntime();
  runtime.existing.add("desktop/.venv/bin/melakat-experiment");
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  const result = await driver.execute({
    action: "validateExperiment",
    payload: {
      specPath: "experiments/smoke.yaml",
      seedCount: 3,
      seedStart: 7,
      ticks: 25,
    },
  });

  assert.equal(result.success, true);
  const commandCall = runtime.calls.find((call) => call.action === "command.run");
  assert(commandCall);
  assert.equal(
    commandCall.payload.command?.command,
    resolve(root, "desktop/.venv/bin/melakat-experiment"),
  );
  assert.deepEqual(commandCall.payload.command?.args, [
    "validate",
    "experiments/smoke.yaml",
    "--seed-count",
    "3",
    "--seed-start",
    "7",
    "--ticks",
    "25",
  ]);
}

{
  const runtime = new FakeEngineeringRuntime();
  runtime.existing.add("desktop/.venv/bin/melakat-experiment");
  runtime.files.set(
    "results/keynu-smoke/validation.json",
    JSON.stringify({
      passed: true,
      failure_count: 0,
      reproducibility: { identical: true },
    }),
  );
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  const result = await driver.execute({
    action: "runExperiment",
    payload: {
      specPath: "experiments/smoke.yaml",
      outputDir: "results/keynu-smoke",
      seedCount: 2,
      ticks: 30,
    },
  });

  assert.equal(result.success, true);
  const data = result.data as any;
  assert.equal(data.processPassed, true);
  assert.equal(data.validationPassed, true);
  assert.equal(data.validation.failure_count, 0);
  assert.equal(
    data.evidencePaths["SHA256SUMS.txt"],
    "results/keynu-smoke/SHA256SUMS.txt",
  );

  const commandCall = runtime.calls.find((call) => call.action === "command.run");
  assert.deepEqual(commandCall?.payload.command?.args, [
    "run",
    "experiments/smoke.yaml",
    "--output-dir",
    "results/keynu-smoke",
    "--seed-count",
    "2",
    "--ticks",
    "30",
    "--quiet",
  ]);
}

{
  const runtime = new FakeEngineeringRuntime();
  runtime.files.set(
    "results/failed/validation.json",
    JSON.stringify({ passed: false, failure_count: 1 }),
  );
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  const result = await driver.execute({
    action: "runExperiment",
    payload: {
      specPath: "experiments/failing.json",
      outputDir: "results/failed",
      quiet: false,
    },
  });

  assert.equal(result.success, false);
  const data = result.data as any;
  assert.equal(data.processPassed, true);
  assert.equal(data.validationPassed, false);
  const commandCall = runtime.calls.find((call) => call.action === "command.run");
  assert.equal(commandCall?.payload.command?.args?.includes("--quiet"), false);
}

{
  const runtime = new FakeEngineeringRuntime();
  runtime.files.set(
    "results/campaign/campaign.json",
    JSON.stringify({
      experiment: "smoke",
      runs: [
        {
          condition: "base",
          seed: 1,
          active_population: 31,
          config_hash: "config-base",
          result_checksum: "result-base",
        },
        {
          condition: "resource_limited",
          seed: 2,
          active_population: 0,
          births: 4,
          deaths: 16,
          faults: 1,
          energy_pool: 0.5,
          local_resource_total: 120.0,
          config_hash: "config-extinct",
          result_checksum: "result-extinct",
        },
      ],
    }),
  );
  runtime.files.set(
    "results/campaign/summary.json",
    JSON.stringify({
      experiment: "smoke",
      run_count: 2,
      condition_count: 2,
      baseline_condition: "base",
      conditions: [
        { condition: "base", run_count: 1 },
        { condition: "resource_limited", run_count: 1 },
      ],
      comparisons: [
        { condition: "resource_limited", active_population_mean_delta: -31 },
      ],
    }),
  );
  runtime.files.set(
    "results/campaign/validation.json",
    JSON.stringify({
      passed: true,
      failure_count: 0,
      failures: [],
      expected_runs: 2,
      completed_runs: 2,
      reproducibility: {
        identical: true,
        reference_checksum: "a".repeat(64),
        repeat_checksum: "a".repeat(64),
      },
    }),
  );
  runtime.files.set(
    "results/campaign/SHA256SUMS.txt",
    `${"1".repeat(64)}  campaign.json\n${"2".repeat(64)}  summary.json\n${"3".repeat(64)}  validation.json\n`,
  );
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  const campaignResult = await driver.execute({
    action: "readCampaign",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(campaignResult.success, true);
  assert.equal((campaignResult.data as any).campaign.experiment, "smoke");

  const validationResult = await driver.execute({
    action: "readValidation",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(validationResult.success, true);
  assert.equal((validationResult.data as any).validation.passed, true);

  const comparisonResult = await driver.execute({
    action: "compareConditions",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(comparisonResult.success, true);
  const comparisonData = comparisonResult.data as any;
  assert.equal(comparisonData.baselineCondition, "base");
  assert.equal(comparisonData.comparisons.length, 1);
  assert.equal(comparisonData.comparisons[0].active_population_mean_delta, -31);

  const evidenceResult = await driver.execute({
    action: "evidenceSummary",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(evidenceResult.success, true);
  const evidence = (evidenceResult.data as any).evidence;
  assert.equal(evidence.scientificClaim, false);
  assert.equal(evidence.experiment, "smoke");
  assert.equal(evidence.runCount, 2);
  assert.equal(evidence.conditionCount, 2);
  assert.equal(evidence.validation.passed, true);
  assert.equal(evidence.validation.completedRuns, 2);
  assert.equal(evidence.checksums["summary.json"], "2".repeat(64));

  const extinctionResult = await driver.execute({
    action: "findExtinctions",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(extinctionResult.success, true);
  const extinctionData = extinctionResult.data as any;
  assert.equal(extinctionData.extinctionCount, 1);
  assert.equal(extinctionData.extinctions[0].condition, "resource_limited");
  assert.equal(extinctionData.extinctions[0].seed, 2);
  assert.equal(extinctionData.extinctions[0].active_population, 0);
  assert.match(extinctionData.interpretation, /does not infer/i);

  const anomalyResult = await driver.execute({
    action: "findAnomalies",
    payload: { outputDir: "results/campaign" },
  });
  assert.equal(anomalyResult.success, true);
  const anomalyData = anomalyResult.data as any;
  assert.equal(anomalyData.integrityPassed, true);
  assert.equal(anomalyData.candidateCount, 0);
  assert.match(anomalyData.interpretation, /not claims of biological anomaly/i);
}

{
  const runtime = new FakeEngineeringRuntime();
  runtime.files.set(
    "results/integrity-failure/validation.json",
    JSON.stringify({
      passed: false,
      failure_count: 2,
      failures: [
        { kind: "energy_balance", error: 0.01, tolerance: 1e-7 },
        { kind: "out_of_bounds", organism_id: 9 },
      ],
      expected_runs: 3,
      completed_runs: 2,
      reproducibility: {
        identical: false,
        reference_checksum: "a".repeat(64),
        repeat_checksum: "b".repeat(64),
      },
    }),
  );
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });
  const result = await driver.execute({
    action: "findAnomalies",
    payload: { outputDir: "results/integrity-failure" },
  });

  assert.equal(result.success, true);
  const data = result.data as any;
  assert.equal(data.integrityPassed, false);
  assert.equal(data.candidateCount, 4);
  assert.equal(
    data.candidates.filter((candidate: any) => candidate.kind === "validation_failure").length,
    2,
  );
  assert.equal(
    data.candidates.some((candidate: any) => candidate.kind === "reproducibility_mismatch"),
    true,
  );
  assert.equal(
    data.candidates.some((candidate: any) => candidate.kind === "run_count_mismatch"),
    true,
  );
  assert.match(data.interpretation, /experimental-integrity/i);
}

{
  const runtime = new FakeEngineeringRuntime();
  const driver = new MelakatDriver({ engineeringRuntime: runtime, projectRoot: root });

  await assert.rejects(
    driver.execute({
      action: "validateExperiment",
      payload: { specPath: "../outside.json" },
    }),
    /inside the Melakat project root/,
  );

  await assert.rejects(
    driver.execute({
      action: "runExperiment",
      payload: {
        specPath: "experiments/smoke.json",
        outputDir: "C:\\outside\\results",
      },
    }),
    /relative to the Melakat project root/,
  );
}

console.log("MelakatDriver tests passed.");
