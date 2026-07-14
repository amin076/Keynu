import { strict as assert } from "node:assert";
import { createIsolatedMissionManager } from "./createIsolatedMissionManager.js";
import type { MissionAckPayload } from "../MissionTypes.js";

const fixture = createIsolatedMissionManager();

try {
  const bootstrap = fixture.manager.prepare({
    conversationUrl: "https://chatgpt.com/c/bootstrap-v2-test",
  });

  function createAck(
    overrides: Partial<MissionAckPayload["payload"]> = {},
  ): MissionAckPayload {
    return {
      protocol: "KAP",
      version: "1.0",
      type: "MISSION_ACK",
      id: "mission-ack-bootstrap-v2-test",
      createdAt: new Date().toISOString(),
      payload: {
        projectId: bootstrap.payload.projectId,
        missionId: bootstrap.payload.missionId,
        acknowledgedBootstrapId: bootstrap.payload.bootstrapId,
        acknowledgedMemoryRevision: bootstrap.payload.memoryRevision,
        status: "ACCEPTED",
        understoodMilestone:
          bootstrap.payload.context.mission.currentMilestone,
        ...overrides,
      },
    };
  }

  assert.throws(
    () =>
      fixture.manager.acknowledge(
        createAck({ acknowledgedBootstrapId: "stale-bootstrap-id" }),
      ),
    /bootstrap ID does not match/i,
  );

  let state = fixture.manager.getStatus().runtimeState;
  assert.equal(state?.status, "BLOCKED");
  assert.equal(state?.lastAssistantAcknowledged, false);

  const retryBootstrap = fixture.manager.prepare({
    conversationUrl: "https://chatgpt.com/c/bootstrap-v2-test",
  });

  assert.throws(
    () =>
      fixture.manager.acknowledge({
        ...createAck(),
        payload: {
          ...createAck().payload,
          acknowledgedBootstrapId: retryBootstrap.payload.bootstrapId,
          acknowledgedMemoryRevision: "stale-memory-revision",
        },
      }),
    /memory revision does not match/i,
  );

  state = fixture.manager.getStatus().runtimeState;
  assert.equal(state?.status, "BLOCKED");
  assert.equal(state?.lastAssistantAcknowledged, false);

  const finalBootstrap = fixture.manager.prepare({
    conversationUrl: "https://chatgpt.com/c/bootstrap-v2-test",
  });

  const accepted = fixture.manager.acknowledge({
    ...createAck(),
    id: "mission-ack-bootstrap-v2-valid",
    payload: {
      ...createAck().payload,
      acknowledgedBootstrapId: finalBootstrap.payload.bootstrapId,
      acknowledgedMemoryRevision: finalBootstrap.payload.memoryRevision,
      understoodMilestone:
        finalBootstrap.payload.context.mission.currentMilestone,
    },
  });

  assert.equal(accepted.status, "ACKNOWLEDGED");
  assert.equal(accepted.lastAssistantAcknowledged, true);
  assert.equal(
    accepted.acknowledgedBootstrapId,
    finalBootstrap.payload.bootstrapId,
  );
  assert.equal(
    accepted.acknowledgedMemoryRevision,
    finalBootstrap.payload.memoryRevision,
  );
  assert.equal(typeof accepted.lastAcknowledgedAt, "string");

  console.log("Bootstrap V2 acknowledgement validation tests passed.");
} finally {
  fixture.dispose();
}
