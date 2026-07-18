import { BootstrapBuilder } from "./BootstrapBuilder.js";
import { ContextAssembler } from "./ContextAssembler.js";
import { ContextBudgeter } from "./ContextBudgeter.js";
import { MissionRegistry } from "./MissionRegistry.js";
import { MissionStateStore } from "./MissionStateStore.js";
import { MissionValidator } from "./MissionValidator.js";
import type {
  MissionAckPayload,
  MissionBootstrapPayload,
  MissionContext,
  MissionRuntimeState,
  MissionValidationResult,
} from "./MissionTypes.js";

export type MissionManagerStatus = {
  projectId: string;
  missionId: string;
  title: string;
  goal: string;
  currentMilestone: string;
  missionStatus: string;
  runtimeState: MissionRuntimeState | null;
  validation: MissionValidationResult;
  warnings: string[];
  openTasks: string[];
  updatedAt: string;
};

export type PrepareMissionOptions = {
  projectId?: string;
  conversationUrl?: string;
};

export class MissionManager {
  constructor(
    private readonly registry = new MissionRegistry(),
    private readonly stateStore = new MissionStateStore(),
    private readonly contextAssembler = new ContextAssembler(
      registry,
      stateStore,
    ),
    private readonly contextBudgeter = new ContextBudgeter(),
    private readonly validator = new MissionValidator(),
    private readonly bootstrapBuilder = new BootstrapBuilder(
      contextAssembler,
      contextBudgeter,
      validator,
      stateStore,
    ),
  ) {}

  prepare(options: PrepareMissionOptions = {}): MissionBootstrapPayload {
    const selection = this.registry.getActiveMission(options.projectId);

    this.stateStore.setActiveMission(
      selection.project.id,
      selection.mission.id,
      selection.mission.currentMilestone,
    );

    this.stateStore.setStatus(selection.mission.id, "LOADING");

    try {
      const context = this.contextAssembler.assemble(selection.project.id);
      const validation = this.validator.validate(context);

      this.stateStore.setStatus(
        selection.mission.id,
        validation.status === "READY" ? "READY" : "BLOCKED",
      );

      if (validation.status !== "READY") {
        throw new Error(
          `Mission '${selection.mission.id}' is blocked: ${validation.checks
            .filter((check) => !check.passed)
            .map((check) => check.message)
            .join("; ")}`,
        );
      }

      return this.bootstrapBuilder.build(options);
    } catch (error) {
      this.stateStore.setStatus(selection.mission.id, "FAILED");
      throw error;
    }
  }

  prepareMessage(options: PrepareMissionOptions = {}): string {
    const bootstrap = this.prepare(options);
    return `\`\`\`kap\n${JSON.stringify(bootstrap, null, 2)}\n\`\`\``;
  }

  getContext(projectId?: string): MissionContext {
    return this.contextBudgeter.apply(
      this.contextAssembler.assemble(projectId),
    );
  }

  getStatus(projectId?: string): MissionManagerStatus {
    const context = this.getContext(projectId);
    const validation = this.validator.validate(context);
    const runtimeState = this.stateStore.getMission(context.mission.id);

    return {
      projectId: context.project.id,
      missionId: context.mission.id,
      title: context.mission.title,
      goal: context.mission.goal,
      currentMilestone: context.mission.currentMilestone,
      missionStatus: runtimeState?.status ?? context.mission.status,
      runtimeState,
      validation,
      warnings: [...new Set([...context.warnings, ...validation.warnings])],
      openTasks: context.openTasks,
      updatedAt: new Date().toISOString(),
    };
  }

  acknowledge(acknowledgement: MissionAckPayload): MissionRuntimeState {
    const {
      projectId,
      missionId,
      acknowledgedBootstrapId,
      acknowledgedMemoryRevision,
      status,
      understoodMilestone,
    } = acknowledgement.payload;
    const selection = this.registry.getActiveMission(projectId);
    const runtimeState = this.stateStore.getMission(missionId);

    if (!runtimeState) {
      throw new Error(`Mission runtime state '${missionId}' was not found.`);
    }

    if (runtimeState.lastBootstrapId !== acknowledgedBootstrapId) {
      this.stateStore.recordAcknowledgement(missionId, false);
      throw new Error("Acknowledgement bootstrap ID does not match the active bootstrap.");
    }

    if (runtimeState.lastBootstrapMemoryRevision !== acknowledgedMemoryRevision) {
      this.stateStore.recordAcknowledgement(missionId, false);
      throw new Error("Acknowledgement memory revision does not match the active bootstrap.");
    }

    if (selection.mission.id !== missionId) {
      throw new Error(
        `Acknowledgement mission '${missionId}' does not match active mission '${selection.mission.id}'.`,
      );
    }

    if (
      understoodMilestone &&
      understoodMilestone !== selection.mission.currentMilestone
    ) {
      this.stateStore.recordAcknowledgement(missionId, false);
      throw new Error(
        `Acknowledged milestone '${understoodMilestone}' does not match '${selection.mission.currentMilestone}'.`,
      );
    }

    return this.stateStore.recordAcknowledgement(
      missionId,
      status === "ACCEPTED",
      acknowledgedBootstrapId,
      acknowledgedMemoryRevision,
    );
  }

  recordJob(jobId: string, projectId?: string): MissionRuntimeState {
    const selection = this.registry.getActiveMission(projectId);
    return this.stateStore.recordJob(selection.mission.id, jobId);
  }

  pause(projectId?: string): MissionRuntimeState {
    const selection = this.registry.getActiveMission(projectId);
    return this.stateStore.setStatus(selection.mission.id, "PAUSED");
  }

  resume(projectId?: string): MissionRuntimeState {
    const selection = this.registry.getActiveMission(projectId);
    return this.stateStore.setStatus(selection.mission.id, "ACTIVE");
  }

  complete(projectId?: string): MissionRuntimeState {
    const selection = this.registry.getActiveMission(projectId);
    return this.stateStore.setStatus(selection.mission.id, "COMPLETED");
  }
}
