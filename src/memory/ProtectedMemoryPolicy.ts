import { createHash } from "node:crypto";
import { normalize, sep } from "node:path";

export type MemoryWriteMode = "replace" | "append";

export type ProtectedMemoryWriteRequest = {
  relativePath: string;
  existingContent?: string;
  incomingContent: string;
  mode?: MemoryWriteMode;
  expectedSha256?: string;
  allowProtectedReplace?: boolean;
};

export type ProtectedMemoryWriteDecision = {
  allowed: boolean;
  protectedPath: boolean;
  mode: MemoryWriteMode;
  resultingContent?: string;
  previousSha256?: string;
  resultingSha256?: string;
  reason?: string;
};

const PROTECTED_MEMORY_PREFIX = `.keynu${sep}memory${sep}`;

export function sha256Text(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function isProtectedMemoryPath(relativePath: string): boolean {
  const normalized = normalize(relativePath).replace(/^([.][\\/])+/, "");
  return normalized === `.keynu${sep}memory` || normalized.startsWith(PROTECTED_MEMORY_PREFIX);
}

export function evaluateProtectedMemoryWrite(
  request: ProtectedMemoryWriteRequest,
): ProtectedMemoryWriteDecision {
  const mode = request.mode ?? "replace";
  const existingContent = request.existingContent;
  const protectedPath = isProtectedMemoryPath(request.relativePath);
  const previousSha256 = existingContent === undefined ? undefined : sha256Text(existingContent);

  if (
    request.expectedSha256 !== undefined &&
    request.expectedSha256 !== previousSha256
  ) {
    return {
      allowed: false,
      protectedPath,
      mode,
      previousSha256,
      reason: "Expected SHA-256 does not match the current file content.",
    };
  }

  if (
    protectedPath &&
    existingContent !== undefined &&
    mode === "replace" &&
    request.allowProtectedReplace !== true
  ) {
    return {
      allowed: false,
      protectedPath,
      mode,
      previousSha256,
      reason: "Replacing an existing protected repository-memory file requires explicit authorization.",
    };
  }

  const resultingContent =
    mode === "append" && existingContent !== undefined
      ? `${existingContent}${request.incomingContent}`
      : request.incomingContent;

  return {
    allowed: true,
    protectedPath,
    mode,
    resultingContent,
    previousSha256,
    resultingSha256: sha256Text(resultingContent),
  };
}
