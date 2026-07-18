import type {
  MissionContext,
  MissionValidationCheck,
  MissionValidationResult,
} from "./MissionTypes.js";

export class MissionValidator {
  validate(context: MissionContext): MissionValidationResult {
    const checks: MissionValidationCheck[] = [
      this.checkProject(context),
      this.checkMission(context),
      this.checkMemory(context),
      this.checkRepository(context),
      this.checkOpenTasks(context),
      this.checkRules(context),
    ];

    const warnings = [...context.warnings];

    if (context.repository.changedFiles.length > 0) {
      warnings.push(
        `Repository has ${context.repository.changedFiles.length} changed file(s).`,
      );
    }

    if (!context.repository.graphSnapshotAvailable) {
      warnings.push("Knowledge graph snapshot is not available yet.");
    }

    return {
      status: checks.every((check) => check.passed) ? "READY" : "BLOCKED",
      checks,
      warnings: [...new Set(warnings)],
    };
  }

  assertReady(context: MissionContext): MissionValidationResult {
    const result = this.validate(context);

    if (result.status !== "READY") {
      const failedChecks = result.checks
        .filter((check) => !check.passed)
        .map((check) => check.name)
        .join(", ");

      throw new Error(`Mission validation failed: ${failedChecks}`);
    }

    return result;
  }

  private checkProject(context: MissionContext): MissionValidationCheck {
    const passed = Boolean(
      context.project.id &&
      context.project.name &&
      context.project.root,
    );

    return {
      name: "project",
      passed,
      message: passed
        ? `Project '${context.project.id}' is configured.`
        : "Project configuration is incomplete.",
    };
  }

  private checkMission(context: MissionContext): MissionValidationCheck {
    const passed = Boolean(
      context.mission.id &&
      context.mission.projectId === context.project.id &&
      context.mission.goal &&
      context.mission.currentMilestone,
    );

    return {
      name: "mission",
      passed,
      message: passed
        ? `Mission '${context.mission.id}' is active at '${context.mission.currentMilestone}'.`
        : "Mission definition is incomplete or belongs to another project.",
    };
  }

  private checkMemory(context: MissionContext): MissionValidationCheck {
    const required = [
      "current_state.md",
      "architecture.md",
      "decisions.md",
      "next_steps.md",
      "startup_prompt.md",
    ];
    const available = new Set(
      context.memory
        .filter((document) => document.exists)
        .map((document) => document.name),
    );
    const missing = required.filter((name) => !available.has(name));

    return {
      name: "memory",
      passed: missing.length === 0,
      message:
        missing.length === 0
          ? "All required mission memory documents are available."
          : `Missing mission memory documents: ${missing.join(", ")}`,
    };
  }

  private checkRepository(context: MissionContext): MissionValidationCheck {
    const passed = Boolean(
      context.repository.root &&
      context.repository.inspectedAt &&
      context.repository.branch,
    );

    return {
      name: "repository",
      passed,
      message: passed
        ? `Repository inspected on branch '${context.repository.branch}'.`
        : "Repository inspection is incomplete.",
    };
  }

  private checkOpenTasks(context: MissionContext): MissionValidationCheck {
    const passed = context.openTasks.length > 0;

    return {
      name: "openTasks",
      passed,
      message: passed
        ? `${context.openTasks.length} open mission task(s) are available.`
        : "Mission has no open tasks.",
    };
  }

  private checkRules(context: MissionContext): MissionValidationCheck {
    const passed = context.rules.length > 0;

    return {
      name: "rules",
      passed,
      message: passed
        ? `${context.rules.length} mission rule(s) are available.`
        : "Mission rules are missing.",
    };
  }
}
