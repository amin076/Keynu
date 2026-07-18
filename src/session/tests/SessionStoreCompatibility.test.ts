import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SessionStore } from "../SessionStore.js";

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function withRoot(test: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "keynu-session-compat-"));

  try {
    test(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

withRoot((root) => {
  writeJson(join(root, ".keynu", "session", "session.json"), {
    version: 1,
    conversationUrl: "https://chatgpt.com/c/test",
    memoryRestored: true,
    runtimeState: "idle",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  });

  const session = new SessionStore(root).read();

  assert.equal(session.conversationUrl, "https://chatgpt.com/c/test");
  assert.equal(session.memoryRestored, true);
  assert.equal(session.runtimeState, "idle");
  assert.equal(session.missionProjectId, undefined);
  assert.equal(session.missionId, undefined);
  assert.equal(session.missionBootstrapId, undefined);
  assert.equal(session.missionMemoryRevision, undefined);
  assert.equal(session.missionRestorationStaleReason, undefined);
});

console.log("SessionStore compatibility tests passed.");
