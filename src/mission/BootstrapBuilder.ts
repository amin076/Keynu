import { ContextAssembler } from "./ContextAssembler.js";
import { ContextBudgeter } from "./ContextBudgeter.js";
import { MissionStateStore } from "./MissionStateStore.js";
import { MissionValidator } from "./MissionValidator.js";
import type { MissionBootstrapPayload } from "./MissionTypes.js";

export type BootstrapBuilderOptions = {
  projectId?: string;
  conversationUrl?: string;
};

export class BootstrapBuilder {
  constructor(
    private readonly contextAssembler = new ContextAssembler(),
    private readonly contextBudgeter = new ContextBudgeter(),
    private readonly missionValidator = new MissionValidator(),
    private readonly stateStore = new MissionStateStore(),
  ) {}

  build(options: BootstrapBuilderOptions = {}): MissionBootstrapPayload {
    const assembledContext = this.contextAssembler.assemble(options.projectId);
    const budgetedContext = this.contextBudgeter.apply(assembledContext);
    const validation = this.missionValidator.validate(budgetedContext);
    const createdAt = new Date().toISOString();
    const bootstrapId = [
      "mission-bootstrap",
      budgetedContext.project.id,
      budgetedContext.mission.id,
      Date.now(),
    ].join("-");

    this.stateStore.setActiveMission(
      budgetedContext.project.id,
      budgetedContext.mission.id,
      budgetedContext.mission.currentMilestone,
    );

    this.stateStore.recordBootstrap(
      budgetedContext.mission.id,
      options.conversationUrl,
    );

    return {
      protocol: "KAP",
      version: "1.0",
      type: "MISSION_BOOTSTRAP",
      id: bootstrapId,
      createdAt,
      payload: {
        projectId: budgetedContext.project.id,
        missionId: budgetedContext.mission.id,
        context: budgetedContext,
        validation,
        requiredResponse: {
          type: "MISSION_ACK",
        },
      },
    };
  }

  buildMessage(options: BootstrapBuilderOptions = {}): string {
    const bootstrap = this.build(options);
    return `\`\`\`kap\n${JSON.stringify(bootstrap, null, 2)}\n\`\`\``;
  }
}
