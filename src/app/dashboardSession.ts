import { SessionStore } from "../session/index.js";

const sessionStore = new SessionStore();

export function readDashboardSession() {
  return sessionStore.read();
}

export function getDashboardRuntime(session = readDashboardSession()) {
  return {
    status: session.runtimeState.toUpperCase(),
    queue: session.runtimeState === "idle" ? "IDLE" : "BUSY",
    lastJob: session.lastJobId ?? "--",
    lastReport: session.lastReportStatus ?? "--",
    lastReportId: session.lastReportId ?? "--",
    memoryRestored: session.memoryRestored,
    updatedAt: session.updatedAt,
  };
}

export function getDashboardBrowser(session = readDashboardSession()) {
  return {
    status: session.conversationUrl ? "CONNECTED" : "UNKNOWN",
    watcher: session.runtimeState === "stopped" ? "STOPPED" : "ACTIVE",
    conversationUrl: session.conversationUrl ?? "--",
    lastSeenMessage: session.lastJobId ?? "--",
  };
}
