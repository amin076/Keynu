export type MissionStatus =
  | "UNCONFIGURED"
  | "LOADING"
  | "VALIDATING"
  | "READY"
  | "BOOTSTRAP_SENT"
  | "ACKNOWLEDGED"
  | "ACTIVE"
  | "PAUSED"
  | "BLOCKED"
  | "FAILED"
  | "COMPLETED";

export type MissionProject = {
  id: string;
  name: string;
  root: string;
  activeMissionId?: string;
};

export type MissionDefinition = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: MissionStatus;
  currentMilestone: string;
  completedMilestones: string[];
  nextMilestones: string[];
  rules: string[];
  updatedAt: string;
};

export type MissionRegistryData = {
  version: "1.0";
  projects: MissionProject[];
};

export type MissionRuntimeState = {
  missionId: string;
  projectId: string;
  status: MissionStatus;
  lastBootstrapAt?: string;
  lastConversationUrl?: string;
  lastAssistantAcknowledged?: boolean;
  lastJobId?: string;
  currentMilestone?: string;
  updatedAt: string;
};

export type MissionMemoryDocument = {
  name: string;
  path: string;
  exists: boolean;
  modifiedAt?: string;
  bytes?: number;
  content?: string;
  stale?: boolean;
};

export type MissionRepositoryState = {
  root: string;
  branch?: string;
  changedFiles: string[];
  packageScripts: Record<string, string>;
  drivers: string[];
  capabilities: string[];
  lastJobId?: string;
  lastReportStatus?: string;
  graphSnapshotAvailable: boolean;
  inspectedAt: string;
};

export type MissionValidationCheck = {
  name: string;
  passed: boolean;
  message: string;
};

export type MissionValidationResult = {
  status: "READY" | "BLOCKED";
  checks: MissionValidationCheck[];
  warnings: string[];
};

export type MissionContext = {
  project: MissionProject;
  mission: MissionDefinition;
  memory: MissionMemoryDocument[];
  repository: MissionRepositoryState;
  openTasks: string[];
  rules: string[];
  warnings: string[];
  generatedAt: string;
};

export type MissionBootstrapPayload = {
  protocol: "KAP";
  version: "1.0";
  type: "MISSION_BOOTSTRAP";
  id: string;
  createdAt: string;
  payload: {
    projectId: string;
    missionId: string;
    context: MissionContext;
    validation: MissionValidationResult;
    requiredResponse: {
      type: "MISSION_ACK";
    };
  };
};

export type MissionAckPayload = {
  protocol: "KAP";
  version: "1.0";
  type: "MISSION_ACK";
  id: string;
  createdAt: string;
  payload: {
    projectId: string;
    missionId: string;
    status: "ACCEPTED" | "REJECTED";
    understoodMilestone?: string;
    message?: string;
  };
};
