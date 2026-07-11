import type { AssistantMessageSnapshot } from "./AssistantMessageSnapshot.js";

export const BrowserEvents = {
  WATCHER_READY: "browser.watcher.ready",
  MESSAGE_DETECTED: "browser.message.detected",
  MESSAGE_READ: "browser.message.read",
  MESSAGE_FAILED: "browser.message.failed",
  MESSAGE_REPORTED: "browser.message.reported",
  CONNECTION_LOST: "browser.connection.lost",
  CONNECTION_RESTORED: "browser.connection.restored",
} as const;

export type BrowserEventName =
  (typeof BrowserEvents)[keyof typeof BrowserEvents];

export type BrowserMessageEvent = {
  message: AssistantMessageSnapshot;
  occurredAt: string;
};

export type BrowserConnectionEvent = {
  conversationUrl?: string;
  error?: string;
  occurredAt: string;
};
