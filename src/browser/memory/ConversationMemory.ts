import { createMessageFingerprint } from "./MessageFingerprint.js";
import { MessageCache } from "./MessageCache.js";
import type { MessageState } from "./MessageState.js";

export class ConversationMemory {
  private readonly cache = new MessageCache();

  async hasSeen(text: string): Promise<boolean> {
    const fingerprint = createMessageFingerprint(text);

    return this.cache.has(fingerprint);
  }

  async remember(
    text: string,
    state: MessageState = "READ",
  ): Promise<void> {
    const fingerprint = createMessageFingerprint(text);

    await this.cache.append({
      id: `message-${fingerprint.slice(0, 12)}`,
      fingerprint,
      state,
      createdAt: new Date().toISOString(),
      textPreview: text.trim().slice(0, 200),
    });
  }
}
