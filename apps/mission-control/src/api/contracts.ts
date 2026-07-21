export type ApiPrimitive = string | number | boolean | null;

export type ApiValue =
  | ApiPrimitive
  | ApiValue[]
  | { [key: string]: ApiValue };

export interface ApiEnvelope<TData> {
  data: TData;
  generatedAt?: string;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  details?: ApiValue;
}

export interface RuntimeHealthContract {
  status: string;
  [key: string]: unknown;
}

export interface PaginationContract {
  total: number;
  limit: number;
  offset: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export interface PaginatedContract<TItem> extends PaginationContract {
  items: TItem[];
}

export type GraphNodeKind =
  | 'project'
  | 'folder'
  | 'file'
  | 'module'
  | 'function'
  | 'class'
  | 'service'
  | 'driver'
  | 'job'
  | 'command'
  | 'report'
  | 'runtime-step';

export type GraphEdgeKind =
  | 'contains'
  | 'imports'
  | 'exports'
  | 'calls'
  | 'depends-on'
  | 'executes'
  | 'reads'
  | 'writes'
  | 'reports-to';

export type GraphNodeState =
  | 'idle'
  | 'queued'
  | 'active'
  | 'success'
  | 'failed'
  | 'warning';

export interface GraphNodeContract {
  id: string;
  label: string;
  kind: GraphNodeKind;
  path?: string;
  parentId?: string;
  state: GraphNodeState;
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeContract {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  state: GraphNodeState;
  metadata?: Record<string, unknown>;
}

export interface EffectiveGraphNodesContract extends PaginatedContract<GraphNodeContract> {}

export interface EffectiveGraphEdgesContract extends PaginationContract {
  items: GraphEdgeContract[];
}

export interface EffectiveGraphSummaryContract {
  ok: boolean;
  graph: {
    available: boolean;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    nodeStates: Partial<Record<GraphNodeState, number>>;
    edgeStates: Partial<Record<GraphNodeState, number>>;
    projection: {
      eventCount: number;
      repositoryPathEvents: number;
      matchedRepositoryEvents: number;
      unmatchedRepositoryEvents: number;
      excludedInternalEvents: number;
      invalidPathEvents: number;
      eventsWithoutPath: number;
    };
  };
}

export interface EffectiveGraphNeighborsContract {
  ok: boolean;
  node: GraphNodeContract | null;
  depth: number;
  nodes: GraphNodeContract[];
  edges: GraphEdgeContract[];
  error?: string;
}

export interface EffectiveGraphImpactContract {
  ok: boolean;
  node: GraphNodeContract | null;
  depth: number;
  impactedNodes: GraphNodeContract[];
  impactEdges: GraphEdgeContract[];
  error?: string;
}
