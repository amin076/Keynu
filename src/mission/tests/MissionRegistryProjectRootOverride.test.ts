import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { MissionRegistry } from "../MissionRegistry.js";

const root = mkdtempSync(join(tmpdir(), "keynu-project-root-override-"));
const override = mkdtempSync(join(tmpdir(), "keynu-melakat-root-"));
const previous = process.env.KEYNU_PROJECT_ROOT_MELAKAT;

try {
  mkdirSync(join(root, "config", "missions", "melakat"), { recursive: true });
  writeFileSync(
    join(root, "config", "missions", "projects.json"),
    JSON.stringify({
      version: "1.0",
      projects: [
        {
          id: "melakat",
          name: "Melakat",
          root: "../melakat",
          activeMissionId: "melakat-development",
        },
      ],
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    join(root, "config", "missions", "melakat", "melakat-development.json"),
    JSON.stringify({
      id: "melakat-development",
      projectId: "melakat",
      title: "Melakat Development",
      goal: "Test external project roots.",
      status: "ACTIVE",
      currentMilestone: "Test root override",
      completedMilestones: [],
      nextMilestones: ["Continue"],
      rules: ["Use the configured project root."],
      updatedAt: new Date().toISOString(),
    }, null, 2),
    "utf8",
  );

  const fallback = new MissionRegistry(root).getProject("melakat");
  assert.equal(fallback.root, resolve(root, "../melakat"));

  process.env.KEYNU_PROJECT_ROOT_MELAKAT = override;
  const registry = new MissionRegistry(root);
  const project = registry.getProject("melakat");
  assert.equal(project.root, resolve(override));

  const selection = registry.getActiveMission("melakat");
  assert.equal(selection.project.root, resolve(override));
  assert.equal(selection.mission.id, "melakat-development");

  console.log("MissionRegistry project root override tests passed.");
} finally {
  if (previous === undefined) delete process.env.KEYNU_PROJECT_ROOT_MELAKAT;
  else process.env.KEYNU_PROJECT_ROOT_MELAKAT = previous;
  rmSync(root, { recursive: true, force: true });
  rmSync(override, { recursive: true, force: true });
}
