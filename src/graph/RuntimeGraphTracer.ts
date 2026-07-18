import { basename } from "node:path";
import { GraphEventStore } from "./GraphEventStore.js";
import type { GraphEvent, GraphNodeState } from "./GraphTypes.js";

export type RuntimeGraphTraceContext = {
  jobId: string;
  missionId?: string;
  workflowId?: string;
  taskId?: string;
  target?: string;
};

export type RuntimeGraphOperation = {
  path?: string;
  command?: string;
  driverId?: string;
  ok?: boolean;
  blocked?: boolean;
  error?: string;
};

function runtimeNodeId(jobId: string): string {
  return `runtime-step:${jobId}`;
}

function operationNodeId(jobId: string, category: string, index: number): string {
  return `runtime-step:${jobId}:${category}:${index}`;
}

function stateType(state: GraphNodeState): GraphEvent["type"] {
  if (state === "queued") return "node.queued";
  if (state === "active") return "node.active";
  if (state === "success") return "node.success";
  if (state === "warning") return "node.warning";
  return "node.failed";
}

export class RuntimeGraphTracer {
  constructor(private readonly store = new GraphEventStore()) {}

  traceQueued(context: RuntimeGraphTraceContext): GraphEvent {
    return this.appendNodeEvent(context, "queued", runtimeNodeId(context.jobId), {
      target: context.target,
      phase: "queued",
    });
  }

  traceStarted(context: RuntimeGraphTraceContext): GraphEvent {
    return this.appendNodeEvent(context, "active", runtimeNodeId(context.jobId), {
      target: context.target,
      phase: "started",
    });
  }

  traceCompleted(
    context: RuntimeGraphTraceContext,
    result: Record<string, unknown> = {},
  ): GraphEvent[] {
    const events: GraphEvent[] = [];
    const reads = Array.isArray(result.reads) ? result.reads as RuntimeGraphOperation[] : [];
    const writes = Array.isArray(result.writes) ? result.writes as RuntimeGraphOperation[] : [];
    const commands = Array.isArray(result.commands) ? result.commands as RuntimeGraphOperation[] : [];

    reads.forEach((operation, index) => {
      events.push(this.traceOperation(context, "read", index, operation));
    });

    writes.forEach((operation, index) => {
      events.push(this.traceOperation(context, "write", index, operation));
    });

    commands.forEach((operation, index) => {
      events.push(this.traceOperation(context, "command", index, operation));
    });

    const failed =
      result.status === "FAILED" ||
      reads.some((item) => item.ok === false) ||
      writes.some((item) => item.ok === false) ||
      commands.some((item) => item.ok === false);

    events.push(
      this.appendNodeEvent(
        context,
        failed ? "failed" : "success",
        runtimeNodeId(context.jobId),
        {
          target: context.target,
          phase: failed ? "failed" : "completed",
          operationCount: reads.length + writes.length + commands.length,
        },
      ),
    );

    return events;
  }

  traceFailed(context: RuntimeGraphTraceContext, error: unknown): GraphEvent {
    return this.appendNodeEvent(context, "failed", runtimeNodeId(context.jobId), {
      target: context.target,
      phase: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private traceOperation(
    context: RuntimeGraphTraceContext,
    category: "read" | "write" | "command",
    index: number,
    operation: RuntimeGraphOperation,
  ): GraphEvent {
    const state: GraphNodeState = operation.ok === false
      ? operation.blocked
        ? "warning"
        : "failed"
      : "success";

    return this.appendNodeEvent(
      {
        ...context,
        taskId: context.taskId ?? context.jobId,
      },
      state,
      operationNodeId(context.jobId, category, index),
      {
        category,
        index,
        path: operation.path,
        fileName: operation.path ? basename(operation.path) : undefined,
        command: operation.command,
        driverId: operation.driverId ?? context.target,
        blocked: operation.blocked === true,
        error: operation.error,
      },
      index,
      operation.driverId ?? context.target,
    );
  }

  private appendNodeEvent(
    context: RuntimeGraphTraceContext,
    state: GraphNodeState,
    nodeId: string,
    metadata: Record<string, unknown>,
    stepIndex?: number,
    driverId?: string,
  ): GraphEvent {
    return this.store.append({
      jobId: context.jobId,
      missionId: context.missionId,
      workflowId: context.workflowId,
      taskId: context.taskId ?? context.jobId,
      stepIndex,
      driverId,
      type: stateType(state),
      nodeId,
      metadata: {
        ...metadata,
        state,
      },
    });
  }
}
