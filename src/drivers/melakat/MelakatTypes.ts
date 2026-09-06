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
  | "compareConditions";

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

export type MelakatValidationArtifact = Record<string, unknown> & {
  passed?: boolean;
  failure_count?: number;
  failures?: unknown[];
  energy_tolerance?: number;
  resource_tolerance?: number;
  reproducibility?: Record<string, unknown>;
};

export type MelakatSummaryArtifact = Record<string, unknown> & {
  baseline_condition?: unknown;
  conditions?: unknown;
  comparisons?: unknown;
};
