import type { MissionContext } from "./MissionTypes.js";

export type ReasoningBriefOptions = {
  maximumCharacters?: number;
  maximumChangedFiles?: number;
  maximumNextActions?: number;
};

export type ReasoningBrief = {
  schemaVersion: "keynu-reasoning-brief-0.1";
  purpose: "TARGETED_REASONING";
  project: { id: string; name: string };
  mission: {
    id: string;
    title: string;
    goal: string;
    currentMilestone: string;
  };
  executionState: {
    branch?: string;
    changedFiles: string[];
    lastJobId?: string;
    lastReportStatus?: string;
    warnings: string[];
  };
  nextActions: Array<{ priority: number; title: string; reason: string }>;
  constraints: string[];
  instructions: string[];
  budget: {
    maximumCharacters: number;
    estimatedCharacters: number;
    truncated: boolean;
  };
};

/**
 * Builds a deliberately small context packet for expensive reasoning agents.
 *
 * Unlike MISSION_BOOTSTRAP, this brief does not copy memory-document bodies,
 * package scripts, driver inventories, or the whole repository context. Keynu
 * keeps those locally and executes deterministic work itself.
 */
export class ReasoningBriefBuilder {
  private readonly maximumCharacters: number;
  private readonly maximumChangedFiles: number;
  private readonly maximumNextActions: number;

  constructor(options: ReasoningBriefOptions = {}) {
    this.maximumCharacters = Math.max(2000, options.maximumCharacters ?? 8000);
    this.maximumChangedFiles = Math.max(1, options.maximumChangedFiles ?? 12);
    this.maximumNextActions = Math.max(1, options.maximumNextActions ?? 6);
  }

  build(context: MissionContext): ReasoningBrief {
    const brief: ReasoningBrief = {
      schemaVersion: "keynu-reasoning-brief-0.1",
      purpose: "TARGETED_REASONING",
      project: {
        id: context.project.id,
        name: context.project.name,
      },
      mission: {
        id: context.mission.id,
        title: context.mission.title,
        goal: context.mission.goal,
        currentMilestone: context.continuation.currentMilestone,
      },
      executionState: {
        branch: context.repository.branch,
        changedFiles: context.repository.changedFiles.slice(0, this.maximumChangedFiles),
        lastJobId: context.repository.lastJobId,
        lastReportStatus: context.repository.lastReportStatus,
        warnings: context.warnings.slice(0, 6),
      },
      nextActions: context.continuation.nextActions.slice(0, this.maximumNextActions),
      constraints: context.rules.slice(0, 8),
      instructions: [
        "Reason only about the decision requested by the mission.",
        "Prefer Keynu tools, MCP, APIs, scripts, build/test and verification for deterministic work.",
        "Do not request a repository-wide audit when the supplied evidence is sufficient.",
        "Ask for one specific missing artifact when more evidence is required.",
        "Return the smallest actionable next plan; Keynu will execute and verify it.",
      ],
      budget: {
        maximumCharacters: this.maximumCharacters,
        estimatedCharacters: 0,
        truncated:
          context.repository.changedFiles.length > this.maximumChangedFiles ||
          context.continuation.nextActions.length > this.maximumNextActions ||
          context.rules.length > 8 ||
          context.warnings.length > 6,
      },
    };

    this.fit(brief);
    brief.budget.estimatedCharacters = this.measure(brief);
    return brief;
  }

  buildMessage(context: MissionContext): string {
    return JSON.stringify(this.build(context), null, 2);
  }

  private fit(brief: ReasoningBrief): void {
    while (this.measure(brief) > this.maximumCharacters) {
      if (brief.executionState.changedFiles.length > 1) {
        brief.executionState.changedFiles.pop();
        brief.budget.truncated = true;
        continue;
      }
      if (brief.nextActions.length > 1) {
        brief.nextActions.pop();
        brief.budget.truncated = true;
        continue;
      }
      if (brief.constraints.length > 1) {
        brief.constraints.pop();
        brief.budget.truncated = true;
        continue;
      }
      if (brief.executionState.warnings.length > 1) {
        brief.executionState.warnings.pop();
        brief.budget.truncated = true;
        continue;
      }

      const fixedOverhead = this.measure({
        ...brief,
        mission: { ...brief.mission, goal: "", title: "" },
      });
      const available = Math.max(0, this.maximumCharacters - fixedOverhead - 64);
      const titleBudget = Math.min(400, Math.floor(available * 0.25));
      brief.mission.title = brief.mission.title.slice(0, titleBudget);
      brief.mission.goal = brief.mission.goal.slice(0, Math.max(0, available - titleBudget));
      brief.budget.truncated = true;
      break;
    }
  }

  private measure(value: unknown): number {
    return JSON.stringify(value).length;
  }
}
