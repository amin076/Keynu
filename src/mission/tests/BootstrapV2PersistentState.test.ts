import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionStateStore } from "../MissionStateStore.js";

const root = mkdtempSync(join(tmpdir(), "keynu-bootstrap-v2-state-"));

try {
  const store = new MissionStateStore(join(root, "state.json"));
  store.setActiveMission("keynu", "knowledge-graph-engine", "Mission Bootstrap V2");

  const sent = store.recordBootstrap(
    "knowledge-graph-engine",
    "https://chatgpt.com/c/test",
    "bootstrap-test-001",
    "revision-test-001",
  );

  assert.equal(sent.status, "BOOTSTRAP_SENT");
  assert.equal(sent.lastBootstrapId, "bootstrap-test-001");
  assert.equal(sent.lastBootstrapMemoryRevision, "revision-test-001");
  assert.equal(sent.lastAssistantAcknowledged, false);

  const acknowledged = store.recordAcknowledgement(
    "knowledge-graph-engine",
    true,
    "bootstrap-test-001",
    "revision-test-001",
  );

  assert.equal(acknowledged.status, "ACKNOWLEDGED");
  assert.equal(acknowledged.lastAssistantAcknowledged, true);
  assert.equal(acknowledged.acknowledgedBootstrapId, "bootstrap-test-001");
  assert.equal(acknowledged.acknowledgedMemoryRevision, "revision-test-001");
  assert.equal(typeof acknowledged.lastAcknowledgedAt, "string");

  const persisted = store.getMission("knowledge-graph-engine");
  assert.equal(persisted?.acknowledgedBootstrapId, "bootstrap-test-001");
  assert.equal(persisted?.acknowledgedMemoryRevision, "revision-test-001");

  console.log("Bootstrap V2 persistent state tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
