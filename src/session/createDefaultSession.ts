import type { KeynuSession } from "./sessionTypes.js";

export function createDefaultSession(): KeynuSession {
  const now = new Date().toISOString();

  return {
    version: 1,
    memoryRestored: false,
    runtimeState: "starting",
    createdAt: now,
    updatedAt: now,
  };
}
