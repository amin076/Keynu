import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type {
  MissionDefinition,
  MissionProject,
  MissionRegistryData,
} from "./MissionTypes.js";

export type ActiveMissionSelection = {
  project: MissionProject;
  mission: MissionDefinition;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as T;
}

export class MissionRegistry {
  private readonly localRegistryPath: string;
  private readonly repositoryRegistryPath: string;

  constructor(
    private readonly repositoryRoot = process.cwd(),
    registryPath?: string,
  ) {
    this.localRegistryPath =
      registryPath ??
      join(repositoryRoot, ".keynu", "missions", "projects.json");
    this.repositoryRegistryPath = join(
      repositoryRoot,
      "config",
      "missions",
      "projects.json",
    );
  }

  loadRegistry(): MissionRegistryData {
    const registryPath = this.selectExistingPath([
      this.localRegistryPath,
      this.repositoryRegistryPath,
    ]);

    if (!registryPath) {
      throw new Error(
        `Mission registry not found. Checked: ${this.localRegistryPath}, ${this.repositoryRegistryPath}`,
      );
    }

    const parsed = readJsonFile<MissionRegistryData>(registryPath);

    if (parsed.version !== "1.0" || !Array.isArray(parsed.projects)) {
      throw new Error("Mission registry is invalid.");
    }

    return parsed;
  }

  getProjects(): MissionProject[] {
    return this.loadRegistry().projects.map((project) => ({
      ...project,
      root: isAbsolute(project.root)
        ? resolve(project.root)
        : resolve(this.repositoryRoot, project.root),
    }));
  }

  getProject(projectId: string): MissionProject {
    const project = this.getProjects().find((item) => item.id === projectId);

    if (!project) {
      throw new Error(`Mission project '${projectId}' was not found.`);
    }

    return project;
  }

  loadMission(projectId: string, missionId: string): MissionDefinition {
    const project = this.getProject(projectId);
    const localMissionPath = join(
      project.root,
      ".keynu",
      "missions",
      project.id,
      `${missionId}.json`,
    );
    const repositoryMissionPath = join(
      this.repositoryRoot,
      "config",
      "missions",
      project.id,
      `${missionId}.json`,
    );
    const missionPath = this.selectExistingPath([
      localMissionPath,
      repositoryMissionPath,
    ]);

    if (!missionPath) {
      throw new Error(
        `Mission definition not found. Checked: ${localMissionPath}, ${repositoryMissionPath}`,
      );
    }

    const mission = readJsonFile<MissionDefinition>(missionPath);

    this.validateMission(project, mission);
    return mission;
  }

  getActiveMission(projectId?: string): ActiveMissionSelection {
    const projects = this.getProjects();
    const project = projectId
      ? projects.find((item) => item.id === projectId)
      : projects.find((item) => Boolean(item.activeMissionId));

    if (!project) {
      throw new Error("No active mission project is configured.");
    }

    if (!project.activeMissionId) {
      throw new Error(`Project '${project.id}' has no active mission.`);
    }

    return {
      project,
      mission: this.loadMission(project.id, project.activeMissionId),
    };
  }

  private selectExistingPath(paths: string[]): string | undefined {
    return paths.find((path) => existsSync(path));
  }

  private validateMission(
    project: MissionProject,
    mission: MissionDefinition,
  ): void {
    if (!mission.id || !mission.projectId || !mission.title || !mission.goal) {
      throw new Error("Mission definition is missing required fields.");
    }

    if (mission.projectId !== project.id) {
      throw new Error(
        `Mission '${mission.id}' belongs to '${mission.projectId}', not '${project.id}'.`,
      );
    }

    if (!mission.currentMilestone) {
      throw new Error(`Mission '${mission.id}' has no current milestone.`);
    }

    if (!Array.isArray(mission.completedMilestones)) {
      throw new Error(`Mission '${mission.id}' completedMilestones is invalid.`);
    }

    if (!Array.isArray(mission.nextMilestones)) {
      throw new Error(`Mission '${mission.id}' nextMilestones is invalid.`);
    }

    if (!Array.isArray(mission.rules)) {
      throw new Error(`Mission '${mission.id}' rules is invalid.`);
    }
  }
}
