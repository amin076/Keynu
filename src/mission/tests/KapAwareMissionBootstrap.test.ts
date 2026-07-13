import { strict as assert } from "node:assert";
import { MissionManager } from "../MissionManager.js";

const bootstrap = new MissionManager().prepare();

assert.equal(bootstrap.protocol, "KAP");
assert.equal(bootstrap.version, "1.0");
assert.equal(bootstrap.type, "MISSION_BOOTSTRAP");
assert.equal(bootstrap.payload.protocolGuide.abbreviation, "KAP");
assert.equal(bootstrap.payload.protocolGuide.version, "1.0");
assert.equal(
  bootstrap.payload.protocolGuide.documentPath,
  "docs/KAP/KAP_PROTOCOL_V1.md",
);
assert.equal(
  bootstrap.payload.protocolGuide.transportFormat,
  "fenced-kap-json",
);
assert(
  bootstrap.payload.protocolGuide.mandatoryRules.some((rule) =>
    rule.includes("KAP JOB"),
  ),
);
assert.equal(bootstrap.payload.requiredResponse.type, "MISSION_ACK");
assert.equal(
  bootstrap.payload.requiredResponse.format,
  "fenced-kap-json",
);
assert.equal(
  bootstrap.payload.requiredResponse.example.type,
  "MISSION_ACK",
);
assert.equal(
  bootstrap.payload.requiredResponse.example.payload.projectId,
  bootstrap.payload.projectId,
);
assert.equal(
  bootstrap.payload.requiredResponse.example.payload.missionId,
  bootstrap.payload.missionId,
);
assert.equal(
  bootstrap.payload.requiredResponse.example.payload.status,
  "ACCEPTED",
);

console.log("KAP-aware mission bootstrap tests passed.");
