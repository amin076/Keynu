import { strict as assert } from "node:assert";
import { extractKapEnvelope } from "../KapExtractor.js";

const validEnvelope = {
  protocol: "KAP",
  version: "1.0",
  type: "JOB",
  id: "job-extractor-validator-test",
  createdAt: new Date().toISOString(),
  payload: { target: "powershell" },
  metadata: {
    correlationId: "correlation-extractor-test",
    sequence: 0,
  },
};

const fenced = extractKapEnvelope(
  "```kap\n" + JSON.stringify(validEnvelope) + "\n```",
);
assert.equal(fenced?.id, validEnvelope.id);
assert.equal(fenced?.metadata?.correlationId, "correlation-extractor-test");

const attributedFence = extractKapEnvelope(
  "```kap id=\"example\"\n" + JSON.stringify(validEnvelope) + "\n```",
);
assert.equal(attributedFence?.id, validEnvelope.id);

const raw = extractKapEnvelope(JSON.stringify(validEnvelope));
assert.equal(raw?.id, validEnvelope.id);

const invalidProtocol = extractKapEnvelope(
  JSON.stringify({ ...validEnvelope, protocol: "OTHER" }),
);
assert.equal(invalidProtocol, null);

const invalidId = extractKapEnvelope(
  JSON.stringify({ ...validEnvelope, id: "" }),
);
assert.equal(invalidId, null);

console.log("KapExtractor validator integration tests passed.");
