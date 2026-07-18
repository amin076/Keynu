import type {
  GraphEdge,
  GraphEvent,
  GraphNode,
  GraphNodeState,
  GraphSnapshot,
} from "./GraphTypes.js";
import { classifyGraphPath, normalizeGraphPath } from "./GraphPathPolicy.js";

function eventState(event: GraphEvent): GraphNodeState {
  if (event.type.endsWith(".queued")) return "queued";
  if (event.type.endsWith(".active")) return "active";
  if (event.type.endsWith(".success")) return "success";
  if (event.type.endsWith(".warning")) return "warning";
  if (event.type.endsWith(".failed")) return "failed";
  return "idle";
}

function addNode(nodes: Map<string, GraphNode>, node: GraphNode): void {
  const existing = nodes.get(node.id);
  if (!existing || String(existing.metadata?.latestRuntimeEventAt ?? "") <= String(node.metadata?.latestRuntimeEventAt ?? "")) {
    nodes.set(node.id, node);
  }
}

function addEdge(edges: Map<string, GraphEdge>, edge: GraphEdge): void {
  const existing = edges.get(edge.id);
  if (!existing || String(existing.metadata?.latestRuntimeEventAt ?? "") <= String(edge.metadata?.latestRuntimeEventAt ?? "")) {
    edges.set(edge.id, edge);
  }
}

export class RuntimeRelationshipProjector {
  project(snapshot: GraphSnapshot, events: GraphEvent[]): GraphSnapshot {
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const edges = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
    const repositoryFiles = new Map(
      snapshot.nodes
        .filter((node) => node.kind === "file")
        .map((node) => [normalizeGraphPath(node.path), node])
        .filter((entry): entry is [string, GraphNode] => Boolean(entry[0])),
    );

    for (const event of [...events].sort((a, b) => a.time.localeCompare(b.time))) {
      if (!event.jobId) continue;

      const state = eventState(event);
      const jobNodeId = `job:${event.jobId}`;
      const phase = typeof event.metadata?.phase === "string" ? event.metadata.phase : undefined;
      const category = typeof event.metadata?.category === "string" ? event.metadata.category : undefined;
      const driverId = event.driverId ?? (typeof event.metadata?.driverId === "string" ? event.metadata.driverId : undefined);

      addNode(nodes, {
        id: jobNodeId,
        label: event.jobId,
        kind: "job",
        state,
        metadata: {
          missionId: event.missionId,
          workflowId: event.workflowId,
          taskId: event.taskId,
          target: event.metadata?.target,
          phase,
          latestRuntimeEventId: event.id,
          latestRuntimeEventAt: event.time,
        },
      });

      if (driverId) {
        const driverNodeId = `driver:${driverId}`;
        addNode(nodes, {
          id: driverNodeId,
          label: driverId,
          kind: "driver",
          state,
          metadata: {
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
        addEdge(edges, {
          id: `${driverNodeId}->${jobNodeId}:executes`,
          source: driverNodeId,
          target: jobNodeId,
          kind: "executes",
          state,
          metadata: {
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
      }

      if (category === "command") {
        const commandNodeId = event.nodeId ?? `command:${event.jobId}:${event.stepIndex ?? 0}`;
        addNode(nodes, {
          id: commandNodeId,
          label: String(event.metadata?.command ?? "command"),
          kind: "command",
          state,
          metadata: {
            jobId: event.jobId,
            stepIndex: event.stepIndex,
            blocked: event.metadata?.blocked,
            error: event.metadata?.error,
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
        addEdge(edges, {
          id: `${jobNodeId}->${commandNodeId}:executes`,
          source: jobNodeId,
          target: commandNodeId,
          kind: "executes",
          state,
          metadata: {
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
      }

      const rawPath = event.metadata?.path;
      if (typeof rawPath === "string" && classifyGraphPath(rawPath) === "repository") {
        const normalizedPath = normalizeGraphPath(rawPath);
        const fileNode = normalizedPath ? repositoryFiles.get(normalizedPath) : undefined;
        if (fileNode && (category === "read" || category === "write")) {
          addEdge(edges, {
            id: `${jobNodeId}->${fileNode.id}:${category}s`,
            source: jobNodeId,
            target: fileNode.id,
            kind: category === "read" ? "reads" : "writes",
            state,
            metadata: {
              operationNodeId: event.nodeId,
              stepIndex: event.stepIndex,
              latestRuntimeEventId: event.id,
              latestRuntimeEventAt: event.time,
            },
          });
        }
      }

      if (phase === "completed" || phase === "failed") {
        const reportNodeId = `report:${event.jobId}`;
        addNode(nodes, {
          id: reportNodeId,
          label: `Report ${event.jobId}`,
          kind: "report",
          state,
          metadata: {
            jobId: event.jobId,
            phase,
            operationCount: event.metadata?.operationCount,
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
        addEdge(edges, {
          id: `${reportNodeId}->${jobNodeId}:reports-to`,
          source: reportNodeId,
          target: jobNodeId,
          kind: "reports-to",
          state,
          metadata: {
            latestRuntimeEventId: event.id,
            latestRuntimeEventAt: event.time,
          },
        });
      }
    }

    return {
      ...snapshot,
      nodes: [...nodes.values()],
      edges: [...edges.values()],
    };
  }
}
