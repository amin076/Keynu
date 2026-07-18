import type {
  GraphEvent,
  GraphNode,
  GraphNodeState,
  GraphSnapshot,
} from "./GraphTypes.js";
import {
  classifyGraphPath,
  normalizeGraphPath,
  type GraphPathClassification,
} from "./GraphPathPolicy.js";
import { RuntimeRelationshipProjector } from "./RuntimeRelationshipProjector.js";

export type GraphEventCorrelation = {
  eventId: string;
  jobId?: string;
  path?: string;
  classification: GraphPathClassification | "no-path";
  repositoryNodeId?: string;
};

export type EffectiveGraphProjection = {
  snapshot: GraphSnapshot;
  correlations: GraphEventCorrelation[];
  summary: {
    eventCount: number;
    repositoryPathEvents: number;
    matchedRepositoryEvents: number;
    unmatchedRepositoryEvents: number;
    excludedInternalEvents: number;
    invalidPathEvents: number;
    eventsWithoutPath: number;
  };
};

function stateFromEvent(event: GraphEvent): GraphNodeState | null {
  if (event.type.endsWith(".queued")) return "queued";
  if (event.type.endsWith(".active")) return "active";
  if (event.type.endsWith(".success")) return "success";
  if (event.type.endsWith(".failed")) return "failed";
  if (event.type.endsWith(".warning")) return "warning";
  return null;
}

export class EffectiveGraphStateProjector {
  constructor(
    private readonly relationshipProjector = new RuntimeRelationshipProjector(),
  ) {}

  project(snapshot: GraphSnapshot, events: GraphEvent[]): EffectiveGraphProjection {
    const nodes = snapshot.nodes.map((node) => ({
      ...node,
      metadata: node.metadata ? { ...node.metadata } : undefined,
    }));

    const edges = snapshot.edges.map((edge) => ({
      ...edge,
      metadata: edge.metadata ? { ...edge.metadata } : undefined,
    }));

    const fileNodesByPath = new Map<string, GraphNode>();

    for (const node of nodes) {
      if (node.kind !== "file") continue;
      const path = normalizeGraphPath(node.path);
      if (path) fileNodesByPath.set(path, node);
    }

    const correlations: GraphEventCorrelation[] = [];
    const newestFirst = [...events].sort((a, b) =>
      b.time.localeCompare(a.time),
    );
    const appliedNodeIds = new Set<string>();

    for (const event of newestFirst) {
      const rawPath = event.metadata?.path;

      if (typeof rawPath !== "string") {
        correlations.push({
          eventId: event.id,
          jobId: event.jobId,
          classification: "no-path",
        });
        continue;
      }

      const classification = classifyGraphPath(rawPath);
      const path = normalizeGraphPath(rawPath) ?? undefined;

      if (classification !== "repository" || !path) {
        correlations.push({
          eventId: event.id,
          jobId: event.jobId,
          path,
          classification,
        });
        continue;
      }

      const node = fileNodesByPath.get(path);

      correlations.push({
        eventId: event.id,
        jobId: event.jobId,
        path,
        classification,
        repositoryNodeId: node?.id,
      });

      if (!node || appliedNodeIds.has(node.id)) continue;

      const state = stateFromEvent(event);
      if (!state) continue;

      node.state = state;
      node.metadata = {
        ...(node.metadata ?? {}),
        latestRuntimeEventId: event.id,
        latestRuntimeEventAt: event.time,
        latestRuntimeJobId: event.jobId,
      };
      appliedNodeIds.add(node.id);
    }

    const repositoryCorrelations = correlations.filter(
      (item) => item.classification === "repository",
    );

    const effectiveSnapshot = this.relationshipProjector.project(
      { ...snapshot, nodes, edges },
      events,
    );

    return {
      snapshot: effectiveSnapshot,
      correlations,
      summary: {
        eventCount: events.length,
        repositoryPathEvents: repositoryCorrelations.length,
        matchedRepositoryEvents: repositoryCorrelations.filter(
          (item) => Boolean(item.repositoryNodeId),
        ).length,
        unmatchedRepositoryEvents: repositoryCorrelations.filter(
          (item) => !item.repositoryNodeId,
        ).length,
        excludedInternalEvents: correlations.filter(
          (item) => item.classification === "excluded-internal",
        ).length,
        invalidPathEvents: correlations.filter(
          (item) => item.classification === "invalid",
        ).length,
        eventsWithoutPath: correlations.filter(
          (item) => item.classification === "no-path",
        ).length,
      },
    };
  }
}
