import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { readJsonFileSafe } from "../dashboardServer.js";

const root = mkdtempSync(join(tmpdir(), "keynu-dashboard-bom-"));

try {
  const missionsDir = join(root, ".keynu", "missions");
  mkdirSync(missionsDir, { recursive: true });

  const expected = {
    version: "1.0",
    projects: {
      keynu: {
        projectId: "keynu",
        name: "Keynu"
      }
    }
  };

  const projectsPath = join(missionsDir, "projects.json");
  writeFileSync(projectsPath, "\uFEFF" + JSON.stringify(expected, null, 2), "utf8");

  const parsed = readJsonFileSafe(projectsPath);
  assert.deepEqual(parsed, expected, "production reader must parse BOM-prefixed JSON");

  const invalidPath = join(missionsDir, "invalid.json");
  writeFileSync(invalidPath, "{not-valid-json", "utf8");
  assert.equal(readJsonFileSafe(invalidPath), null, "production reader must preserve safe-null behavior");

  console.log("Dashboard production BOM regression test passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
