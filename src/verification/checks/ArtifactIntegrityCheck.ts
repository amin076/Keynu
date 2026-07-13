import type { RuntimeExecutionResult } from "../../core/results/RuntimeExecutionResult.js";
import type { VerificationCheck } from "../VerificationResult.js";

type ArtifactMetadata = {
  size?: number;
  sha256?: string;
  modifiedAt?: string;
};

type ArtifactRecord = {
  path?: string;
  ok?: boolean;
  artifact?: ArtifactMetadata;
};

function collectExecutionPayloads(result: RuntimeExecutionResult): Record<string, unknown>[] {
  const values: Record<string, unknown>[] = [];

  for (const step of result.steps ?? []) {
    if (step.result && typeof step.result === "object") {
      values.push(step.result as Record<string, unknown>);
    }
  }

  return values;
}

export function checkArtifactIntegrity(
  result: RuntimeExecutionResult,
): VerificationCheck {
  const payloads = collectExecutionPayloads(result);
  const writes = new Map<string, ArtifactMetadata>();
  const reads = new Map<string, ArtifactMetadata>();

  for (const payload of payloads) {
    if (Array.isArray(payload.writes)) {
      for (const value of payload.writes) {
        const item = value as ArtifactRecord;
        if (
          item?.ok === true &&
          typeof item.path === "string" &&
          item.artifact &&
          typeof item.artifact.sha256 === "string"
        ) {
          writes.set(item.path, item.artifact);
        }
      }
    }

    if (Array.isArray(payload.reads)) {
      for (const value of payload.reads) {
        const item = value as ArtifactRecord;
        if (
          item?.ok === true &&
          typeof item.path === "string" &&
          item.artifact &&
          typeof item.artifact.sha256 === "string"
        ) {
          reads.set(item.path, item.artifact);
        }
      }
    }
  }

  if (writes.size === 0) {
    return {
      name: "artifact-integrity",
      passed: false,
      message: "No written artifact hash evidence was found.",
    };
  }

  const mismatches: string[] = [];
  const missingReads: string[] = [];
  let verifiedArtifacts = 0;

  for (const [path, writtenArtifact] of writes) {
    const readArtifact = reads.get(path);

    if (!readArtifact) {
      missingReads.push(path);
      continue;
    }

    const hashMatches = writtenArtifact.sha256 === readArtifact.sha256;
    const sizeMatches =
      typeof writtenArtifact.size !== "number" ||
      typeof readArtifact.size !== "number" ||
      writtenArtifact.size === readArtifact.size;

    if (!hashMatches || !sizeMatches) {
      mismatches.push(path);
      continue;
    }

    verifiedArtifacts += 1;
  }

  const passed =
    verifiedArtifacts === writes.size &&
    mismatches.length === 0 &&
    missingReads.length === 0;

  let message: string;

  if (passed) {
    message = `${verifiedArtifacts} written artifact(s) passed SHA-256 integrity verification.`;
  } else if (mismatches.length > 0) {
    message = `Artifact hash or size mismatch: ${mismatches.join(", ")}`;
  } else {
    message = `Written artifacts were not read back for verification: ${missingReads.join(", ")}`;
  }

  return {
    name: "artifact-integrity",
    passed,
    message,
  };
}
