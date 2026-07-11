import { PowerShellProcessManager } from "./PowerShellProcessManager.js";

const manager = new PowerShellProcessManager();

export type ProcessManagerAction = "start" | "list" | "stop" | "logs";

export type ProcessManagerPayload = {
  processAction?: ProcessManagerAction;
  processId?: string;
  command?: string;
  args?: string[];
  cwd: string;
  logPath?: string;
  maxChars?: number;
};

export async function handleProcessManagerPayload(payload: ProcessManagerPayload) {
  const action = payload.processAction;
  if (!action) return null;

  if (action === "start") {
    if (!payload.processId) throw new Error("processId is required for processAction=start");
    if (!payload.command) throw new Error("command is required for processAction=start");

    return {
      processAction: action,
      record: manager.start({
        id: payload.processId,
        command: payload.command,
        args: payload.args ?? [],
        cwd: payload.cwd,
        logPath: payload.logPath,
      }),
    };
  }

  if (action === "list") {
    return {
      processAction: action,
      processes: manager.list(payload.cwd),
    };
  }

  if (action === "stop") {
    if (!payload.processId) throw new Error("processId is required for processAction=stop");
    return {
      processAction: action,
      record: manager.stop(payload.processId, payload.cwd),
    };
  }

  if (action === "logs") {
    if (!payload.processId) throw new Error("processId is required for processAction=logs");
    return {
      processAction: action,
      processId: payload.processId,
      logs: manager.readLog(payload.processId, payload.maxChars ?? 4000, payload.cwd),
    };
  }

  throw new Error("Unsupported processAction: " + action);
}
