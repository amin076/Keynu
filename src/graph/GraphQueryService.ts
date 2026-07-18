import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { GraphEdge, GraphNode, GraphSnapshot } from "./GraphTypes.js";

export type GraphQueryOptions = {
  nodeKind?: string;
  nodeState?: string;
  edgeKind?: string;
  edgeState?: string;
  search?: string;
  offset?: number;
  limit?: number;
};

export type GraphSummary = {
  available: boolean;
  version?: string;
  projectName?: string;
  generatedAt?: string;
  bytes?: number;
  nodeCount: number;
  edgeCount: number;
  nodeKinds: Record<string, number>;
  nodeStates: Record<string, number>;
  edgeKinds: Record<string, number>;
  edgeStates: Record<string, number>;
};

function countBy<T>(items: T[], select: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = select(item);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function normalizeInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(0, Math.floor(value as number)));
}

export class GraphQueryService {
  constructor(
    private readonly snapshotPath = join(process.cwd(), ".keynu", "graph", "snapshot.json"),
  ) {}

  readSnapshot(): GraphSnapshot | null {
    if (!existsSync(this.snapshotPath)) return null;
    const parsed = JSON.parse(readFileSync(this.snapshotPath, "utf8")) as GraphSnapshot;
    if (parsed.version !== "1.0" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw new Error("Graph snapshot is invalid.");
    }
    return parsed;
  }

  getSummary(): GraphSummary {
    const snapshot = this.readSnapshot();
    if (!snapshot) {
      return {
        available: false,
        nodeCount: 0,
        edgeCount: 0,
        nodeKinds: {},
        nodeStates: {},
        edgeKinds: {},
        edgeStates: {},
      };
    }

    return {
      available: true,
      version: snapshot.version,
      projectName: basename(snapshot.projectRoot),
      generatedAt: snapshot.generatedAt,
      bytes: statSync(this.snapshotPath).size,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      nodeKinds: countBy(snapshot.nodes, (node) => node.kind),
      nodeStates: countBy(snapshot.nodes, (node) => node.state),
      edgeKinds: countBy(snapshot.edges, (edge) => edge.kind),
      edgeStates: countBy(snapshot.edges, (edge) => edge.state),
    };
  }

  queryNodes(options: GraphQueryOptions = {}) {
    const snapshot = this.readSnapshot();
    const offset = normalizeInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
    const limit = normalizeInteger(options.limit, 100, 500);
    if (!snapshot) return { total: 0, offset, limit, items: [] as GraphNode[] };

    const search = options.search?.trim().toLowerCase();
    const filtered = snapshot.nodes.filter((node) => {
      if (options.nodeKind && node.kind !== options.nodeKind) return false;
      if (options.nodeState && node.state !== options.nodeState) return false;
      if (search) {
        const candidate = [node.id, node.label, node.path ?? ""].join(" ").toLowerCase();
        if (!candidate.includes(search)) return false;
      }
      return true;
    });

    return {
      total: filtered.length,
      offset,
      limit,
      items: filtered.slice(offset, offset + limit),
    };
  }

  queryEdges(options: GraphQueryOptions = {}) {
    const snapshot = this.readSnapshot();
    const offset = normalizeInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
    const limit = normalizeInteger(options.limit, 100, 500);
    if (!snapshot) return { total: 0, offset, limit, items: [] as GraphEdge[] };

    const search = options.search?.trim().toLowerCase();
    const filtered = snapshot.edges.filter((edge) => {
      if (options.edgeKind && edge.kind !== options.edgeKind) return false;
      if (options.edgeState && edge.state !== options.edgeState) return false;
      if (search) {
        const candidate = [edge.id, edge.source, edge.target].join(" ").toLowerCase();
        if (!candidate.includes(search)) return false;
      }
      return true;
    });

    return {
      total: filtered.length,
      offset,
      limit,
      items: filtered.slice(offset, offset + limit),
    };
  }
}
