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
  architectureDecisions?: Array<{
    title: string;
    summary: string;
    documentPath?: string;
  }>;
  recommendedReading?: Array<{
    title: string;
    path: string;
    reason: string;
    priority: number;
  }>;
  knownLimitations?: string[];
  nextActions?: Array<{
    priority: number;
    title: string;
    reason: string;
  }>;
  rules: string[];
  updatedAt: string;
};

export type MissionRegistryData = {
  version: "1.0";
  projects: MissionProject[];
};

export type MissionRecoveryTestEvidence = {
  status: "VERIFIED" | "FAILED";
  conversationUrl?: string;
  missionAcknowledged: boolean;
  acknowledgementId?: string;
  verifiedReportId?: string;
  certificateId?: string;
  recordedAt: string;
};

export type MissionRuntimeState = {
  missionId: string;
  projectId: string;
  status: MissionStatus;
  lastBootstrapAt?: string;
  lastBootstrapId?: string;
  lastBootstrapMemoryRevision?: string;
  lastConversationUrl?: string;
  lastAssistantAcknowledged?: boolean;
  acknowledgedBootstrapId?: string;
  acknowledgedMemoryRevision?: string;
  lastAcknowledgedAt?: string;
  lastJobId?: string;
  currentMilestone?: string;
  lastRecoveryTest?: MissionRecoveryTestEvidence;
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
  continuation: {
    currentMilestone: string;
    pendingMilestones: string[];
    architectureDecisions: Array<{
      title: string;
      summary: string;
      documentPath?: string;
    }>;
    recommendedReading: Array<{
      title: string;
      path: string;
      reason: string;
      priority: number;
    }>;
    knownLimitations: string[];
    nextActions: Array<{
      priority: number;
      title: string;
      reason: string;
    }>;
  };
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
    bootstrapId: string;
    memoryRevision: string;
    context: MissionContext;
    validation: MissionValidationResult;
    protocolGuide: {
      name: "Keynu Agent Protocol";
      abbreviation: "KAP";
      version: "1.0";
      purpose: string;
      documentPath: string;
      transportFormat: "fenced-kap-json";
      mandatoryRules: string[];
    };
    requiredResponse: {
      type: "MISSION_ACK";
      format: "fenced-kap-json";
      requiredFields: string[];
      example: MissionAckPayload;
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
    acknowledgedBootstrapId: string;
    acknowledgedMemoryRevision: string;
    status: "ACCEPTED" | "REJECTED";
    understoodMilestone?: string;
    message?: string;
  };
};
