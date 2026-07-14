import { ContextAssembler } from "./ContextAssembler.js";
import { ContextBudgeter } from "./ContextBudgeter.js";
import { MissionStateStore } from "./MissionStateStore.js";
import { MissionValidator } from "./MissionValidator.js";
import { MemoryRevisionCalculator } from "./MemoryRevisionCalculator.js";
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
    private readonly memoryRevisionCalculator = new MemoryRevisionCalculator(),
  ) {}

  build(options: BootstrapBuilderOptions = {}): MissionBootstrapPayload {
    const assembledContext = this.contextAssembler.assemble(options.projectId);
    const budgetedContext = this.contextBudgeter.apply(assembledContext);
    const validation = this.missionValidator.validate(budgetedContext);
    const memoryRevision = this.memoryRevisionCalculator.calculate(budgetedContext).revision;
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
      bootstrapId,
      memoryRevision,
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
        bootstrapId,
        memoryRevision,
        context: budgetedContext,
        validation,
        protocolGuide: {
          name: "Keynu Agent Protocol",
          abbreviation: "KAP",
          version: "1.0",
          purpose:
            "KAP is the application-level JSON protocol used between Keynu and AI systems for missions, jobs, reports, errors, evidence, and control messages.",
          documentPath: "docs/KAP/KAP_PROTOCOL_V1.md",
          transportFormat: "fenced-kap-json",
          mandatoryRules: [
            "Return the requested MISSION_ACK before sending executable jobs.",
            "Place every KAP envelope inside one fenced kap code block.",
            "Use valid JSON with protocol KAP and version 1.0.",
            "Send executable work only as KAP JOB messages.",
            "Do not claim local completion without a corresponding KAP REPORT.",
            "Keep jobs and requested reports small enough for the chat transport limit.",
          ],
        },
        requiredResponse: {
          type: "MISSION_ACK",
          format: "fenced-kap-json",
          requiredFields: [
            "protocol",
            "version",
            "type",
            "id",
            "createdAt",
            "payload.projectId",
            "payload.missionId",
            "payload.acknowledgedBootstrapId",
            "payload.acknowledgedMemoryRevision",
            "payload.status",
            "payload.understoodMilestone",
          ],
          example: {
            protocol: "KAP",
            version: "1.0",
            type: "MISSION_ACK",
            id: "mission-ack-" + budgetedContext.mission.id,
            createdAt,
            payload: {
              projectId: budgetedContext.project.id,
              missionId: budgetedContext.mission.id,
              acknowledgedBootstrapId: bootstrapId,
              acknowledgedMemoryRevision: memoryRevision,
              status: "ACCEPTED",
              understoodMilestone:
                budgetedContext.mission.currentMilestone,
              message:
                "KAP 1.0 instructions and the active mission were understood.",
            },
          },
        },
      },
    };
  }

  buildMessage(options: BootstrapBuilderOptions = {}): string {
    const bootstrap = this.build(options);
    return `\`\`\`kap\n${JSON.stringify(bootstrap, null, 2)}\n\`\`\``;
  }
}
