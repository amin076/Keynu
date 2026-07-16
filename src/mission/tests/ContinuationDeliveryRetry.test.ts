import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContinuationDeliveryService } from "../ContinuationDeliveryService.js";
import type { ContinuationRequestContext } from "../ContinuationRequestBuilder.js";
import { ContinuationDeliveryStore } from "../ContinuationDeliveryStore.js";

function createContext(jobId: string): ContinuationRequestContext {
  return {
    missionId: "continuation-retry-test-mission",
    missionTitle: "Continuation Retry Test Mission",
    jobId,
    autonomousStepCount: 1,
    maxAutonomousSteps: 12,
    continuation: {
      decision: "CONTINUE",
      owner: "ai",
      missionComplete: false,
      reason: 'Verify bounded continuation retry behavior.',
      nextAction: 'Continue the active mission.',
    },
  };
}

const rootDir = mkdtempSync(join(tmpdir(), "keynu-continuation-retry-"));

try {
  const store = new ContinuationDeliveryStore({ rootDir });
  const service = new ContinuationDeliveryService(store);

  let transientAttempts = 0;
  const transientResult = await service.deliver(
    createContext("job-transient-continuation-retry"),
    async () => {
      transientAttempts += 1;
      if (transientAttempts < 3) {
        throw new Error("ChatGPT message submission could not be confirmed.");
      }
    },
  );

  assert.equal(transientAttempts, 3);
  assert.equal(transientResult.status, "DELIVERED");

  const deliveredRecord = JSON.parse(
    readFileSync(
      join(rootDir, transientResult.requestId + ".json"),
      "utf8",
    ),
  );
  assert.equal(deliveredRecord.status, "DELIVERED");
  assert.equal(deliveredRecord.attemptCount, 1);

  let permanentAttempts = 0;
  const permanentResult = await service.deliver(
    createContext("job-permanent-continuation-retry"),
    async () => {
      permanentAttempts += 1;
      throw new Error("Persistent continuation delivery failure.");
    },
  );

  assert.equal(permanentAttempts, 3);
  assert.equal(permanentResult.status, "FAILED");
  assert.match(permanentResult.reason, /Persistent continuation delivery failure/);

  const failedRecord = JSON.parse(
    readFileSync(
      join(rootDir, permanentResult.requestId + ".json"),
      "utf8",
    ),
  );
  assert.equal(failedRecord.status, "FAILED");
  assert.equal(failedRecord.attemptCount, 1);
  assert.match(failedRecord.lastError, /Persistent continuation delivery failure/);

  console.log("PASS ContinuationDeliveryRetry");
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
