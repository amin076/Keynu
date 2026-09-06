import { resolve } from "node:path";
import type { Driver, DriverResult } from "../../core/Driver.js";
import { EngineeringRuntime } from "../../engineering/EngineeringRuntime.js";
import type { EngineeringOperationResult } from "../../engineering/EngineeringTypes.js";
import { MissionRegistry } from "../../mission/MissionRegistry.js";
import type {
  MelakatAction,
  MelakatEngineeringRuntime,
  MelakatPayload,
  MelakatSummaryArtifact,
  MelakatValidationArtifact,
} from "./MelakatTypes.js";

export type MelakatDriverOptions = {
  engineeringRuntime?: MelakatEngineeringRuntime;
  missionRegistry?: MissionRegistry;
  projectRoot?: string;
};

type ResolvedCli = {
  command: string;
  source: "venv-windows" | "venv-posix" | "path";
};

const ACTIONS: MelakatAction[] = [
  "status",
  "validateExperiment",
  "runExperiment",
  "readCampaign",
  "readValidation",
  "compareConditions",
];

const EVIDENCE_FILES = [
  "campaign.json",
  "summary.json",
  "validation.json",
  "runs.csv",
  "comparison.csv",
  "provenance.json",
  "SHA256SUMS.txt",
] as const;

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireProjectRelativePath(value: unknown, label: string): string {
  const raw = requireString(value, label);
  const portable = raw.replace(/\\/g, "/");

  if (
    portable.startsWith("/") ||
    portable.startsWith("//") ||
    /^[A-Za-z]:\//.test(portable)
  ) {
    throw new Error(`${label} must be relative to the Melakat project root.`);
  }

  const segments = portable.split("/").filter((segment) => segment && segment !== ".");
  if (segments.length === 0 || segments.includes("..")) {
    throw new Error(`${label} must stay inside the Melakat project root.`);
  }

  return segments.join("/");
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function readContent(result: EngineeringOperationResult, label: string): string {
  if (!result.success) {
    throw new Error(`${label} could not be read: ${result.summary}`);
  }
  const data = result.data as { content?: unknown } | undefined;
  if (typeof data?.content !== "string") {
    throw new Error(`${label} read returned no text content.`);
  }
  return data.content;
}

function parseJsonObject<T extends Record<string, unknown>>(
  content: string,
  label: string,
): T {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return parsed as T;
}

function joinProjectPath(...parts: string[]): string {
  return parts
    .flatMap((part) => part.replace(/\\/g, "/").split("/"))
    .filter(Boolean)
    .join("/");
}

export class MelakatDriver implements Driver {
  readonly id = "melakat";
  readonly name = "Melakat Research Driver";
  readonly status = "Registered";
  readonly capabilities = [...ACTIONS];

  private readonly engineeringRuntime: MelakatEngineeringRuntime;
  private readonly missionRegistry: MissionRegistry;
  private readonly projectRootOverride?: string;

  constructor(options: MelakatDriverOptions = {}) {
    this.engineeringRuntime = options.engineeringRuntime ?? new EngineeringRuntime();
    this.missionRegistry = options.missionRegistry ?? new MissionRegistry();
    this.projectRootOverride = options.projectRoot;
  }

  async initialize(): Promise<void> {
    // Do not require Melakat to exist just to start Keynu. The project root is
    // resolved and validated by Engineering Runtime when a Melakat action runs.
  }

  async execute(command: unknown): Promise<DriverResult> {
    if (!command || typeof command !== "object") {
      throw new Error("Melakat driver requires a command object.");
    }

    const record = command as Record<string, unknown>;
    const action = record.action;
    if (typeof action !== "string" || !ACTIONS.includes(action as MelakatAction)) {
      throw new Error(`Unsupported Melakat action: ${String(action)}`);
    }

    const payload =
      record.payload && typeof record.payload === "object"
        ? (record.payload as MelakatPayload)
        : {};

    switch (action as MelakatAction) {
      case "status":
        return await this.getStatus(payload);
      case "validateExperiment":
        return await this.validateExperiment(payload);
      case "runExperiment":
        return await this.runExperiment(payload);
      case "readCampaign":
        return await this.readCampaign(payload);
      case "readValidation":
        return await this.readValidation(payload);
      case "compareConditions":
        return await this.compareConditions(payload);
    }
  }

  private resolveProjectRoot(payload: MelakatPayload): string {
    return (
      payload.projectRoot ??
      this.projectRootOverride ??
      this.missionRegistry.getProject("melakat").root
    );
  }

  private async pathExists(projectRoot: string, path: string): Promise<boolean> {
    const result = await this.engineeringRuntime.execute("fs.exists", {
      projectRoot,
      path,
    });
    const data = result.data as { exists?: unknown } | undefined;
    return result.success && data?.exists === true;
  }

  private async resolveCli(projectRoot: string): Promise<ResolvedCli> {
    const windowsCandidate = "desktop/.venv/Scripts/melakat-experiment.exe";
    if (await this.pathExists(projectRoot, windowsCandidate)) {
      return {
        command: resolve(projectRoot, windowsCandidate),
        source: "venv-windows",
      };
    }

    const posixCandidate = "desktop/.venv/bin/melakat-experiment";
    if (await this.pathExists(projectRoot, posixCandidate)) {
      return {
        command: resolve(projectRoot, posixCandidate),
        source: "venv-posix",
      };
    }

    return { command: "melakat-experiment", source: "path" };
  }

  private buildOverrideArgs(payload: MelakatPayload): string[] {
    const args: string[] = [];
    if (payload.seedCount !== undefined) {
      args.push("--seed-count", String(requirePositiveInteger(payload.seedCount, "seedCount")));
    }
    if (payload.seedStart !== undefined) {
      args.push("--seed-start", String(requireInteger(payload.seedStart, "seedStart")));
    }
    if (payload.ticks !== undefined) {
      args.push("--ticks", String(requirePositiveInteger(payload.ticks, "ticks")));
    }
    return args;
  }

  private async runCli(
    projectRoot: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ cli: ResolvedCli; result: EngineeringOperationResult }> {
    const cli = await this.resolveCli(projectRoot);
    const result = await this.engineeringRuntime.execute("command.run", {
      projectRoot,
      command: {
        command: cli.command,
        args,
        cwd: projectRoot,
        timeoutMs,
      },
    });
    return { cli, result };
  }

  private async getStatus(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const [pyprojectExists, runnerExists] = await Promise.all([
      this.pathExists(projectRoot, "desktop/pyproject.toml"),
      this.pathExists(projectRoot, "desktop/src/melakat_desktop/experiment_runner.py"),
    ]);
    const cli = await this.resolveCli(projectRoot);
    const ready = pyprojectExists && runnerExists;

    return {
      success: ready,
      message: ready
        ? "Melakat experiment interface is available."
        : "Melakat project was resolved but the expected experiment interface is incomplete.",
      data: {
        projectRoot,
        ready,
        pyprojectExists,
        runnerExists,
        cli,
      },
    };
  }

  private async validateExperiment(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const specPath = requireProjectRelativePath(payload.specPath, "specPath");
    const args = ["validate", specPath, ...this.buildOverrideArgs(payload)];
    const { cli, result } = await this.runCli(
      projectRoot,
      args,
      payload.timeoutMs ?? 120_000,
    );

    return {
      success: result.success,
      message: result.success
        ? "Melakat experiment specification validated successfully."
        : "Melakat experiment specification validation failed.",
      data: {
        projectRoot,
        specPath,
        cli,
        execution: result,
      },
    };
  }

  private async runExperiment(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const specPath = requireProjectRelativePath(payload.specPath, "specPath");
    const outputDir = requireProjectRelativePath(payload.outputDir, "outputDir");
    const args = [
      "run",
      specPath,
      "--output-dir",
      outputDir,
      ...this.buildOverrideArgs(payload),
    ];
    if (payload.quiet !== false) args.push("--quiet");

    const { cli, result } = await this.runCli(
      projectRoot,
      args,
      payload.timeoutMs ?? 600_000,
    );

    let validation: MelakatValidationArtifact | undefined;
    let validationReadError: string | undefined;
    try {
      validation = await this.readJsonArtifact<MelakatValidationArtifact>(
        projectRoot,
        joinProjectPath(outputDir, "validation.json"),
        "Melakat validation artifact",
      );
    } catch (error) {
      validationReadError = error instanceof Error ? error.message : String(error);
    }

    const processPassed = result.success;
    const validationPassed = validation?.passed === true;
    const success = processPassed && validationPassed;
    const evidencePaths = Object.fromEntries(
      EVIDENCE_FILES.map((name) => [name, joinProjectPath(outputDir, name)]),
    );

    return {
      success,
      message: success
        ? "Melakat experiment campaign completed with passing validation evidence."
        : "Melakat experiment campaign did not produce a passing process-and-validation result.",
      data: {
        projectRoot,
        specPath,
        outputDir,
        cli,
        processPassed,
        validationPassed,
        validation,
        validationReadError,
        evidencePaths,
        execution: result,
      },
    };
  }

  private async readCampaign(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const outputDir = requireProjectRelativePath(payload.outputDir, "outputDir");
    const path = joinProjectPath(outputDir, "campaign.json");
    const campaign = await this.readJsonArtifact<Record<string, unknown>>(
      projectRoot,
      path,
      "Melakat campaign artifact",
    );

    return {
      success: true,
      message: "Melakat campaign artifact read successfully.",
      data: { projectRoot, path, campaign },
    };
  }

  private async readValidation(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const outputDir = requireProjectRelativePath(payload.outputDir, "outputDir");
    const path = joinProjectPath(outputDir, "validation.json");
    const validation = await this.readJsonArtifact<MelakatValidationArtifact>(
      projectRoot,
      path,
      "Melakat validation artifact",
    );

    return {
      success: validation.passed === true,
      message:
        validation.passed === true
          ? "Melakat validation artifact reports passed=true."
          : "Melakat validation artifact does not report passed=true.",
      data: { projectRoot, path, validation },
    };
  }

  private async compareConditions(payload: MelakatPayload): Promise<DriverResult> {
    const projectRoot = this.resolveProjectRoot(payload);
    const outputDir = requireProjectRelativePath(payload.outputDir, "outputDir");
    const path = joinProjectPath(outputDir, "summary.json");
    const summary = await this.readJsonArtifact<MelakatSummaryArtifact>(
      projectRoot,
      path,
      "Melakat summary artifact",
    );

    const conditions = Array.isArray(summary.conditions) ? summary.conditions : [];
    const comparisons = Array.isArray(summary.comparisons) ? summary.comparisons : [];

    return {
      success: true,
      message: "Melakat condition comparison evidence read successfully.",
      data: {
        projectRoot,
        path,
        baselineCondition: summary.baseline_condition ?? null,
        conditions,
        comparisons,
      },
    };
  }

  private async readJsonArtifact<T extends Record<string, unknown>>(
    projectRoot: string,
    path: string,
    label: string,
  ): Promise<T> {
    const result = await this.engineeringRuntime.execute("fs.readFile", {
      projectRoot,
      path,
    });
    return parseJsonObject<T>(readContent(result, label), label);
  }
}
