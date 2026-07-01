import type { MessageState } from "./MessageState.js";

export type MessageHistoryEntry = {
  id: string;
  fingerprint: string;
  state: MessageState;
  createdAt: string;
  textPreview: string;
};

export class MessageHistory {
  private readonly entries: MessageHistoryEntry[] = [];

  constructor(private readonly maxEntries = 100) {}

  add(entry: MessageHistoryEntry): void {
    this.entries.unshift(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
  }

  hasFingerprint(fingerprint: string): boolean {
    return this.entries.some((entry) => entry.fingerprint === fingerprint);
  }

  getAll(): MessageHistoryEntry[] {
    return [...this.entries];
  }
}
