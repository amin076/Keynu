import type {
  EngineeringAction,
  EngineeringOperationResult,
  EngineeringPayload,
} from "../../engineering/EngineeringTypes.js";

export type MelakatAction =
  | "status"
  | "validateExperiment"
  | "runExperiment"
  | "readCampaign"
  | "readValidation"
  | "compareConditions"
  | "evidenceSummary"
  | "findExtinctions"
  | "findAnomalies";

export type MelakatPayload = {
  projectRoot?: string;
  specPath?: string;
  outputDir?: string;
  seedCount?: number;
  seedStart?: number;
  ticks?: number;
  quiet?: boolean;
  timeoutMs?: number;
};

export type MelakatEngineeringRuntime = {
  execute(
    action: EngineeringAction,
    payload: EngineeringPayload,
  ): Promise<EngineeringOperationResult>;
};

export type MelakatCampaignArtifact = Record<string, unknown> & {
  experiment?: unknown;
  runs?: unknown;
  validation?: unknown;
};

export type MelakatValidationArtifact = Record<string, unknown> & {
  passed?: boolean;
  failure_count?: number;
  failures?: unknown[];
  expected_runs?: number;
  completed_runs?: number;
  energy_tolerance?: number;
  resource_tolerance?: number;
  reproducibility?: Record<string, unknown>;
};

export type MelakatSummaryArtifact = Record<string, unknown> & {
  experiment?: unknown;
  run_count?: unknown;
  condition_count?: unknown;
  baseline_condition?: unknown;
  conditions?: unknown;
  comparisons?: unknown;
};
