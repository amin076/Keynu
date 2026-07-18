import { strict as assert } from "node:assert";
import { validateKapEnvelope } from "../KapValidator.js";

const valid = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-validator-test",
  createdAt: new Date().toISOString(),
  payload: { target: "powershell" },
  metadata: { correlationId: "correlation-1", sequence: 0 },
});
assert.equal(valid.valid, true);

const invalid = validateKapEnvelope({
  protocol: "OTHER",
  version: "1.0",
  type: "JOB",
  id: "",
});
assert.equal(invalid.valid, false);
if (!invalid.valid) assert(invalid.issues.length > 0);

console.log("KapValidator tests passed.");

const timezoneOffset = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-timezone-offset-test",
  createdAt: "2026-07-14T08:20:00+10:00",
  payload: { target: "powershell" },
});
assert.equal(timezoneOffset.valid, true);
