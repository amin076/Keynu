import { strict as assert } from "node:assert";
import { validateKapEnvelope } from "../KapValidator.js";

const valid = validateKapEnvelope({
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-validator-test",
  createdAt: new Date().toISOString(),
  payload: {},
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
