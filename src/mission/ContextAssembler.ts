import { ActiveMissionResolver } from "./ActiveMissionResolver.js";
import { MemoryLoader } from "./MemoryLoader.js";
import { MissionRegistry } from "./MissionRegistry.js";
import { MissionStateStore } from "./MissionStateStore.js";
import { ProjectInspector } from "./ProjectInspector.js";
import type {
  MissionContext,
  MissionMemoryDocument,
} from "./MissionTypes.js";

export class ContextAssembler {
  private readonly activeMissionResolver: ActiveMissionResolver;

  constructor(
    private readonly registry = new MissionRegistry(),
    private readonly stateStore = new MissionStateStore(),
    activeMissionResolver?: ActiveMissionResolver,
  ) {
    this.activeMissionResolver =
      activeMissionResolver ??
      new ActiveMissionResolver({ registry, stateStore });
  }

  assemble(projectId?: string): MissionContext {
    const resolution = this.activeMissionResolver.resolve({ projectId });
    if (resolution.action === "BLOCKED") {
      throw new Error(
        `Active mission resolution failed: ${resolution.diagnostics.join(" ")}`,
      );
    }

    const project = this.registry.getProject(resolution.projectId);
    const mission = this.registry.loadMission(
      resolution.projectId,
      resolution.missionId,
    );
    const memoryLoader = new MemoryLoader(project.root);
    const projectInspector = new ProjectInspector(project.root);
    const memory = memoryLoader.loadAll();
    const repository = projectInspector.inspect();
    const runtimeState = this.stateStore.getMission(mission.id);
    const warnings = this.collectWarnings(
      memory,
      repository.branch,
      runtimeState?.currentMilestone,
      mission.currentMilestone,
    );

    if (resolution.requiresBootstrap) {
      warnings.push(...resolution.diagnostics);
    }

    return {
      project,
      mission,
      memory,
      repository,
      openTasks: [...mission.nextMilestones],
      continuation: {
        currentMilestone: mission.currentMilestone,
        pendingMilestones: [...mission.nextMilestones],
        architectureDecisions: [...(mission.architectureDecisions ?? [])],
        recommendedReading: [...(mission.recommendedReading ?? [])]
          .sort((a, b) => a.priority - b.priority),
        knownLimitations: [...(mission.knownLimitations ?? [])],
        nextActions: [...(mission.nextActions ?? [])]
          .sort((a, b) => a.priority - b.priority),
      },
      rules: [...new Set(mission.rules)],
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }

  private collectWarnings(
    memory: MissionMemoryDocument[],
    branch: string | undefined,
    runtimeMilestone: string | undefined,
    missionMilestone: string,
  ): string[] {
    const warnings: string[] = [];
    const missing = memory.filter((document) => !document.exists);
    const stale = memory.filter((document) => document.exists && document.stale);

    if (missing.length > 0) {
      warnings.push(
        `Missing memory documents: ${missing.map((document) => document.name).join(", ")}`,
      );
    }

    if (stale.length > 0) {
      warnings.push(
        `Stale memory documents: ${stale.map((document) => document.name).join(", ")}`,
      );
    }

    if (!branch) {
      warnings.push("Git branch could not be detected.");
    }

    if (runtimeMilestone && runtimeMilestone !== missionMilestone) {
      warnings.push(
        `Runtime milestone '${runtimeMilestone}' differs from mission milestone '${missionMilestone}'.`,
      );
    }

    return warnings;
  }
}
