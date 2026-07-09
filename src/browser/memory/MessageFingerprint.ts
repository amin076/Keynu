import crypto from "node:crypto";

export function createMessageFingerprint(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex");
}
