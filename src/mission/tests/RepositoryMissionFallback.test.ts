import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionRegistry } from "../MissionRegistry.js";

const root = mkdtempSync(join(tmpdir(), "keynu-mission-fallback-"));
mkdirSync(join(root, "config"), { recursive: true });
cpSync(join(process.cwd(), "config", "missions"), join(root, "config", "missions"), { recursive: true });

try {
  const selection = new MissionRegistry(root).getActiveMission();
  assert.equal(selection.project.id, "keynu");
  assert.equal(selection.mission.id, "knowledge-graph-engine");
  assert.equal(
    selection.mission.currentMilestone,
    "Clean New-Chat Recovery Verification",
  );
  assert(selection.mission.nextActions?.length);
  console.log("Repository mission fallback tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
