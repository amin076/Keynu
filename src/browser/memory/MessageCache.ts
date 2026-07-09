import fs from "node:fs/promises";
import path from "node:path";
import type { MessageHistoryEntry } from "./MessageHistory.js";

export type MessageCacheData = {
  messages: MessageHistoryEntry[];
};

export class MessageCache {
  constructor(
    private readonly filePath = path.resolve(
      "runtime-data",
      "memory",
      "message-cache.json",
    ),
  ) {}

  async load(): Promise<MessageCacheData> {
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(text) as Partial<MessageCacheData>;

      return {
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    } catch {
      return { messages: [] };
    }
  }

  async save(data: MessageCacheData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    await fs.writeFile(
      this.filePath,
      JSON.stringify(data, null, 2),
      "utf8",
    );
  }

  async has(fingerprint: string): Promise<boolean> {
    const data = await this.load();

    return data.messages.some(
      (message) => message.fingerprint === fingerprint,
    );
  }

  async append(entry: MessageHistoryEntry): Promise<void> {
    const data = await this.load();

    const messages = [
      entry,
      ...data.messages.filter(
        (message) => message.fingerprint !== entry.fingerprint,
      ),
    ].slice(0, 100);

    await this.save({ messages });
  }

  async clear(): Promise<void> {
    await this.save({ messages: [] });
  }
}
