import { GraphEventStore } from "./GraphEventStore.js";
import { GraphSnapshotStore } from "./GraphSnapshotStore.js";
import { EffectiveGraphStateProjector } from "./EffectiveGraphStateProjector.js";
import type { GraphEdge, GraphNode } from "./GraphTypes.js";

export type EffectiveGraphQueryOptions = {
  search?: string;
  kind?: string;
  state?: string;
  offset?: number;
  limit?: number;
};

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(0, Math.floor(value as number)));
}

export class EffectiveGraphQueryService {
  constructor(
    private readonly snapshotStore = new GraphSnapshotStore(),
    private readonly eventStore = new GraphEventStore(),
    private readonly projector = new EffectiveGraphStateProjector(),
  ) {}

  getProjection() {
    return this.projector.project(
      this.snapshotStore.read(),
      this.eventStore.readAll(),
    );
  }

  getSummary() {
    const projection = this.getProjection();

    const nodeStates = projection.snapshot.nodes.reduce<Record<string, number>>(
      (counts, node) => {
        counts[node.state] = (counts[node.state] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const edgeStates = projection.snapshot.edges.reduce<Record<string, number>>(
      (counts, edge) => {
        counts[edge.state] = (counts[edge.state] ?? 0) + 1;
        return counts;
      },
      {},
    );

    return {
      available: true,
      generatedAt: projection.snapshot.generatedAt,
      nodeCount: projection.snapshot.nodes.length,
      edgeCount: projection.snapshot.edges.length,
      nodeStates,
      edgeStates,
      projection: projection.summary,
    };
  }

  queryNodes(options: EffectiveGraphQueryOptions = {}) {
    const offset = normalizeInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
    const limit = normalizeInteger(options.limit, 100, 500);
    const search = options.search?.trim().toLowerCase();

    const items = this.getProjection().snapshot.nodes.filter((node) =>
      (!options.kind || node.kind === options.kind) &&
      (!options.state || node.state === options.state) &&
      (!search || this.matchesNode(node, search))
    );

    return {
      total: items.length,
      offset,
      limit,
      items: items.slice(offset, offset + limit),
    };
  }

  queryEdges(options: EffectiveGraphQueryOptions = {}) {
    const offset = normalizeInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
    const limit = normalizeInteger(options.limit, 100, 500);
    const search = options.search?.trim().toLowerCase();

    const items = this.getProjection().snapshot.edges.filter((edge) =>
      (!options.kind || edge.kind === options.kind) &&
      (!options.state || edge.state === options.state) &&
      (!search || this.matchesEdge(edge, search))
    );

    return {
      total: items.length,
      offset,
      limit,
      items: items.slice(offset, offset + limit),
    };
  }

  getNode(nodeId: string): GraphNode | null {
    return this.getProjection().snapshot.nodes.find((node) => node.id === nodeId) ?? null;
  }

  queryNeighbors(nodeId: string, depth = 1) {
    const projection = this.getProjection();
    const maximumDepth = normalizeInteger(depth, 1, 5);
    const nodesById = new Map(projection.snapshot.nodes.map((node) => [node.id, node]));
    const visited = new Set<string>([nodeId]);
    const frontier: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    while (frontier.length > 0) {
      const current = frontier.shift();
      if (!current || current.depth >= maximumDepth) continue;

      for (const edge of projection.snapshot.edges) {
        let nextNodeId: string | null = null;
        if (edge.source === current.nodeId) nextNodeId = edge.target;
        else if (edge.target === current.nodeId) nextNodeId = edge.source;
        if (!nextNodeId) continue;

        edgeIds.add(edge.id);
        nodeIds.add(nextNodeId);
        if (!visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          frontier.push({ nodeId: nextNodeId, depth: current.depth + 1 });
        }
      }
    }

    return {
      node: nodesById.get(nodeId) ?? null,
      depth: maximumDepth,
      nodes: [...nodeIds].map((id) => nodesById.get(id)).filter((node): node is GraphNode => Boolean(node)),
      edges: projection.snapshot.edges.filter((edge) => edgeIds.has(edge.id)),
    };
  }

  queryImpact(nodeId: string, depth = 3) {
    const projection = this.getProjection();
    const maximumDepth = normalizeInteger(depth, 3, 8);
    const nodesById = new Map(projection.snapshot.nodes.map((node) => [node.id, node]));
    const visited = new Set<string>([nodeId]);
    const frontier: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];
    const impactedNodeIds = new Set<string>();
    const impactEdgeIds = new Set<string>();

    while (frontier.length > 0) {
      const current = frontier.shift();
      if (!current || current.depth >= maximumDepth) continue;

      for (const edge of projection.snapshot.edges) {
        if (!["imports", "calls", "depends-on"].includes(edge.kind)) continue;
        if (edge.target !== current.nodeId) continue;
        impactedNodeIds.add(edge.source);
        impactEdgeIds.add(edge.id);
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          frontier.push({ nodeId: edge.source, depth: current.depth + 1 });
        }
      }
    }

    return {
      node: nodesById.get(nodeId) ?? null,
      depth: maximumDepth,
      impactedNodes: [...impactedNodeIds].map((id) => nodesById.get(id)).filter((node): node is GraphNode => Boolean(node)),
      impactEdges: projection.snapshot.edges.filter((edge) => impactEdgeIds.has(edge.id)),
    };
  }

  queryRecentActivity(limit = 50) {
    const normalizedLimit = normalizeInteger(limit, 50, 500);
    const projection = this.getProjection();
    const nodesById = new Map(projection.snapshot.nodes.map((node) => [node.id, node]));

    return projection.correlations
      .filter((correlation) => Boolean(correlation.repositoryNodeId))
      .map((correlation) => ({
        ...correlation,
        node: correlation.repositoryNodeId
          ? nodesById.get(correlation.repositoryNodeId) ?? null
          : null,
      }))
      .slice(0, normalizedLimit);
  }

  private matchesNode(node: GraphNode, search: string): boolean {
    return [node.id, node.label, node.path, node.kind, node.state]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  }

  private matchesEdge(edge: GraphEdge, search: string): boolean {
    return [edge.id, edge.source, edge.target, edge.kind, edge.state]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  }
}
