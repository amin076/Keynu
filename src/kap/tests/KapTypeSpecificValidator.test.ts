import { strict as assert } from "node:assert";
import { validateKapEnvelope } from "../KapValidator.js";

const createdAt = new Date().toISOString();

const validJob = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-valid-001",
  createdAt,
  payload: { target: "powershell", cwd: "C:\\Physics\\Keynu" },
});
assert.equal(validJob.valid, true);

const invalidJob = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-invalid-001",
  createdAt,
  payload: {},
});
assert.equal(invalidJob.valid, false);

const validReport = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "REPORT",
  id: "report-job-valid-001",
  createdAt,
  payload: {
    jobId: "job-valid-001",
    status: "COMPLETED",
    result: {},
  },
});
assert.equal(validReport.valid, true);

const invalidReport = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "REPORT",
  id: "report-invalid-001",
  createdAt,
  payload: { status: "COMPLETED" },
});
assert.equal(invalidReport.valid, false);

const validAck = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "MISSION_ACK",
  id: "mission-ack-test",
  createdAt,
  payload: {
    projectId: "keynu",
    missionId: "knowledge-graph-engine",
    status: "ACCEPTED",
  },
});
assert.equal(validAck.valid, true);

const invalidAck = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "MISSION_ACK",
  id: "mission-ack-invalid",
  createdAt,
  payload: { status: "ACCEPTED" },
});
assert.equal(invalidAck.valid, false);

const validError = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "ERROR",
  id: "error-test",
  createdAt,
  payload: { error: "Execution failed." },
});
assert.equal(validError.valid, true);

const invalidControl = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "CONTROL",
  id: "control-invalid",
  createdAt,
  payload: { action: "DESTROY_EVERYTHING" },
});
assert.equal(invalidControl.valid, false);

const unsupportedVersion = validateKapEnvelope({
  protocol: "KAP",
  version: "2.0",
  type: "JOB",
  id: "job-version-invalid",
  createdAt,
  payload: { target: "powershell" },
});
assert.equal(unsupportedVersion.valid, false);

console.log("KAP type-specific validator tests passed.");
