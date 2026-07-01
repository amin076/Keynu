import type { ConversationMessage } from "./ConversationMessage.js";

export interface ConversationAdapter {
  connect(): Promise<void>;

  readLatestAssistantMessage(): Promise<ConversationMessage | null>;

  waitUntilGenerationFinished(): Promise<void>;

  sendUserMessage(message: string): Promise<void>;

  uploadFiles?(filePaths: string[]): Promise<void>;

  takeScreenshot?(outputPath: string): Promise<void>;

  disconnect(): Promise<void>;
}