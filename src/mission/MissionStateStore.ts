import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MissionRuntimeState, MissionStatus } from "./MissionTypes.js";

export type MissionStateStoreData = {
  version: "1.0";
  activeProjectId?: string;
  activeMissionId?: string;
  missions: Record<string, MissionRuntimeState>;
  updatedAt: string;
};

function createEmptyState(): MissionStateStoreData {
  return {
    version: "1.0",
    missions: {},
    updatedAt: new Date().toISOString(),
  };
}

export class MissionStateStore {
  constructor(
    private readonly statePath = join(
      process.cwd(),
      ".keynu",
      "missions",
      "state.json",
    ),
  ) {}

  read(): MissionStateStoreData {
    if (!existsSync(this.statePath)) {
      return createEmptyState();
    }

    const parsed = JSON.parse(
      readFileSync(this.statePath, "utf8"),
    ) as MissionStateStoreData;

    if (parsed.version !== "1.0" || !parsed.missions) {
      throw new Error("Mission state store is invalid.");
    }

    return parsed;
  }

  write(state: MissionStateStoreData): MissionStateStoreData {
    const normalized: MissionStateStoreData = {
      ...state,
      version: "1.0",
      updatedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  }

  getMission(missionId: string): MissionRuntimeState | null {
    return this.read().missions[missionId] ?? null;
  }

  setActiveMission(
    projectId: string,
    missionId: string,
    currentMilestone: string,
  ): MissionRuntimeState {
    const state = this.read();
    const existing = state.missions[missionId];
    const now = new Date().toISOString();

    const missionState: MissionRuntimeState = {
      missionId,
      projectId,
      status: existing?.status ?? "READY",
      lastBootstrapAt: existing?.lastBootstrapAt,
      lastConversationUrl: existing?.lastConversationUrl,
      lastAssistantAcknowledged: existing?.lastAssistantAcknowledged ?? false,
      lastJobId: existing?.lastJobId,
      currentMilestone,
      updatedAt: now,
    };

    state.activeProjectId = projectId;
    state.activeMissionId = missionId;
    state.missions[missionId] = missionState;
    this.write(state);
    return missionState;
  }

  updateMission(
    missionId: string,
    patch: Partial<Omit<MissionRuntimeState, "missionId" | "updatedAt">>,
  ): MissionRuntimeState {
    const state = this.read();
    const existing = state.missions[missionId];

    if (!existing) {
      throw new Error(`Mission runtime state '${missionId}' was not found.`);
    }

    const updated: MissionRuntimeState = {
      ...existing,
      ...patch,
      missionId,
      updatedAt: new Date().toISOString(),
    };

    state.missions[missionId] = updated;
    this.write(state);
    return updated;
  }

  setStatus(missionId: string, status: MissionStatus): MissionRuntimeState {
    return this.updateMission(missionId, { status });
  }

  recordBootstrap(
    missionId: string,
    conversationUrl?: string,
  ): MissionRuntimeState {
    return this.updateMission(missionId, {
      status: "BOOTSTRAP_SENT",
      lastBootstrapAt: new Date().toISOString(),
      lastConversationUrl: conversationUrl,
      lastAssistantAcknowledged: false,
    });
  }

  recordAcknowledgement(
    missionId: string,
    accepted: boolean,
  ): MissionRuntimeState {
    return this.updateMission(missionId, {
      status: accepted ? "ACKNOWLEDGED" : "BLOCKED",
      lastAssistantAcknowledged: accepted,
    });
  }

  recordJob(missionId: string, jobId: string): MissionRuntimeState {
    return this.updateMission(missionId, {
      lastJobId: jobId,
      status: "ACTIVE",
    });
  }
}
