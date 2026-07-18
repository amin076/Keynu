import { MissionRegistry } from "./MissionRegistry.js";
import { MissionStateStore } from "./MissionStateStore.js";

export type ActiveMissionResolutionAction =
  | "NONE"
  | "RECONCILE_STATE"
  | "REQUIRE_BOOTSTRAP"
  | "BLOCKED";

export type ActiveMissionResolutionReason =
  | "CONFIG_AND_STATE_MATCH"
  | "PERSISTED_STATE_MISSING"
  | "PERSISTED_ACTIVE_MISSION_MISMATCH"
  | "MISSION_DEFINITION_MISSING"
  | "REGISTRY_INVALID"
  | "MISSION_STATE_INVALID";

export type ActiveMissionResolution = {
  projectId: string;
  missionId: string;
  missionTitle: string;
  currentMilestone: string;
  persistedActiveProjectId?: string;
  persistedActiveMissionId?: string;
  action: ActiveMissionResolutionAction;
  reasons: ActiveMissionResolutionReason[];
  stateMismatch: boolean;
  requiresBootstrap: boolean;
  diagnostics: string[];
};

export type ActiveMissionReconciliationPlan = {
  resolution: ActiveMissionResolution;
  shouldReconcileState: boolean;
  projectId?: string;
  missionId?: string;
  currentMilestone?: string;
  reason?: ActiveMissionResolutionReason;
  diagnostics: string[];
};

export type ActiveMissionReconciliationResult = {
  resolution: ActiveMissionResolution;
  plan: ActiveMissionReconciliationPlan;
  stateChanged: boolean;
};

export type ActiveMissionResolverOptions = {
  registry?: MissionRegistry;
  stateStore?: MissionStateStore;
};

export type ResolveActiveMissionOptions = {
  projectId?: string;
};

export class ActiveMissionResolver {
  private readonly registry: MissionRegistry;
  private readonly stateStore: MissionStateStore;

  constructor(options: ActiveMissionResolverOptions = {}) {
    this.registry = options.registry ?? new MissionRegistry();
    this.stateStore = options.stateStore ?? new MissionStateStore();
  }

  resolve(options: ResolveActiveMissionOptions = {}): ActiveMissionResolution {
    const configured = this.readConfiguredMission(options.projectId);

    if (configured.blocked) {
      return configured.resolution;
    }

    const persisted = this.readPersistedState(configured.resolution);

    if (persisted.blocked) {
      return persisted.resolution;
    }

    const resolution = configured.resolution;
    const persistedActiveProjectId = persisted.activeProjectId;
    const persistedActiveMissionId = persisted.activeMissionId;
    const stateMissing = !persistedActiveMissionId;
    const stateMismatch =
      Boolean(persistedActiveMissionId) &&
      (persistedActiveMissionId !== resolution.missionId ||
        persistedActiveProjectId !== resolution.projectId);

    if (stateMissing) {
      return {
        ...resolution,
        persistedActiveProjectId,
        persistedActiveMissionId,
        action: "RECONCILE_STATE",
        reasons: ["PERSISTED_STATE_MISSING"],
        stateMismatch: true,
        requiresBootstrap: true,
        diagnostics: [
          ...resolution.diagnostics,
          "Persisted mission state is missing an active mission. Configured mission remains authoritative.",
        ],
      };
    }

    if (stateMismatch) {
      return {
        ...resolution,
        persistedActiveProjectId,
        persistedActiveMissionId,
        action: "REQUIRE_BOOTSTRAP",
        reasons: ["PERSISTED_ACTIVE_MISSION_MISMATCH"],
        stateMismatch: true,
        requiresBootstrap: true,
        diagnostics: [
          ...resolution.diagnostics,
          `Configured active mission '${resolution.missionId}' differs from persisted active mission '${persistedActiveMissionId}'.`,
          "Configured mission priority wins; runtime state requires later reconciliation.",
        ],
      };
    }

    return {
      ...resolution,
      persistedActiveProjectId,
      persistedActiveMissionId,
      action: "NONE",
      reasons: ["CONFIG_AND_STATE_MATCH"],
      stateMismatch: false,
      requiresBootstrap: false,
      diagnostics: [
        ...resolution.diagnostics,
        `Configured and persisted active mission match: '${resolution.missionId}'.`,
      ],
    };
  }

  private readConfiguredMission(
    projectId?: string,
  ):
    | { blocked: false; resolution: ActiveMissionResolution }
    | { blocked: true; resolution: ActiveMissionResolution } {
    try {
      const selection = this.registry.getActiveMission(projectId);

      return {
        blocked: false,
        resolution: {
          projectId: selection.project.id,
          missionId: selection.mission.id,
          missionTitle: selection.mission.title,
          currentMilestone: selection.mission.currentMilestone,
          action: "NONE",
          reasons: [],
          stateMismatch: false,
          requiresBootstrap: false,
          diagnostics: [
            `Configured active mission resolved from MissionRegistry: '${selection.mission.id}'.`,
          ],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason: ActiveMissionResolutionReason = message.includes(
        "Mission definition not found",
      )
        ? "MISSION_DEFINITION_MISSING"
        : "REGISTRY_INVALID";

      return {
        blocked: true,
        resolution: {
          projectId: "",
          missionId: "",
          missionTitle: "",
          currentMilestone: "",
          action: "BLOCKED",
          reasons: [reason],
          stateMismatch: false,
          requiresBootstrap: false,
          diagnostics: [`Active mission could not be resolved: ${message}`],
        },
      };
    }
  }

  private readPersistedState(
    baseResolution: ActiveMissionResolution,
  ):
    | {
        blocked: false;
        activeProjectId?: string;
        activeMissionId?: string;
      }
    | { blocked: true; resolution: ActiveMissionResolution } {
    try {
      const state = this.stateStore.read();

      return {
        blocked: false,
        activeProjectId: state.activeProjectId,
        activeMissionId: state.activeMissionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        blocked: true,
        resolution: {
          ...baseResolution,
          action: "BLOCKED",
          reasons: ["MISSION_STATE_INVALID"],
          stateMismatch: false,
          requiresBootstrap: false,
          diagnostics: [
            ...baseResolution.diagnostics,
            `Persisted mission state could not be read: ${message}`,
          ],
        },
      };
    }
  }

  buildReconciliationPlan(
    resolution: ActiveMissionResolution = this.resolve(),
  ): ActiveMissionReconciliationPlan {
    const shouldReconcileState =
      resolution.action !== "BLOCKED" &&
      (resolution.reasons.includes("PERSISTED_STATE_MISSING") ||
        resolution.reasons.includes("PERSISTED_ACTIVE_MISSION_MISMATCH"));

    if (!shouldReconcileState) {
      return {
        resolution,
        shouldReconcileState: false,
        diagnostics: [
          ...resolution.diagnostics,
          "No mission-state reconciliation is required.",
        ],
      };
    }

    const reason = resolution.reasons.includes("PERSISTED_STATE_MISSING")
      ? "PERSISTED_STATE_MISSING"
      : "PERSISTED_ACTIVE_MISSION_MISMATCH";

    return {
      resolution,
      shouldReconcileState: true,
      projectId: resolution.projectId,
      missionId: resolution.missionId,
      currentMilestone: resolution.currentMilestone,
      reason,
      diagnostics: [
        ...resolution.diagnostics,
        `Mission-state reconciliation will set active mission '${resolution.missionId}'.`,
      ],
    };
  }

  reconcile(
    options: ResolveActiveMissionOptions = {},
  ): ActiveMissionReconciliationResult {
    const resolution = this.resolve(options);
    const plan = this.buildReconciliationPlan(resolution);

    if (
      !plan.shouldReconcileState ||
      !plan.projectId ||
      !plan.missionId ||
      !plan.currentMilestone
    ) {
      return {
        resolution,
        plan,
        stateChanged: false,
      };
    }

    this.stateStore.setActiveMission(
      plan.projectId,
      plan.missionId,
      plan.currentMilestone,
    );

    return {
      resolution: this.resolve(options),
      plan,
      stateChanged: true,
    };
  }
}
