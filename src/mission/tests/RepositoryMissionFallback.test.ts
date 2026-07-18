import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, cpSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionRegistry } from "../MissionRegistry.js";

const root = mkdtempSync(join(tmpdir(), "keynu-mission-fallback-"));
mkdirSync(join(root, "config"), { recursive: true });
cpSync(join(process.cwd(), "config", "missions"), join(root, "config", "missions"), { recursive: true });

try {
  const selection = new MissionRegistry(root).getActiveMission();
  assert.equal(selection.project.id, "keynu");
  assert.equal(selection.mission.id, "openai-build-week");
  assert.equal(
    selection.mission.currentMilestone,
    "Define the winning submission concept and minimum competition-ready demo",
  );
  assert(selection.mission.nextActions?.length);

  writeFileSync(
    join(root, "config", "missions", "projects.json"),
    JSON.stringify({
      version: "1.0",
      projects: [
        {
          id: "keynu",
          name: "Keynu",
          root: ".",
          activeMissionId: "knowledge-graph-engine",
        },
      ],
    }, null, 2),
    "utf8",
  );

  const legacySelection = new MissionRegistry(root).getActiveMission();
  assert.equal(legacySelection.project.id, "keynu");
  assert.equal(legacySelection.mission.id, "knowledge-graph-engine");
  assert.equal(
    legacySelection.mission.currentMilestone,
    "Clean New-Chat Recovery Verification",
  );
  console.log("Repository mission fallback tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
