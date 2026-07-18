export type GraphNodeKind =
  | "project"
  | "folder"
  | "file"
  | "module"
  | "function"
  | "class"
  | "service"
  | "driver"
  | "job"
  | "command"
  | "report"
  | "runtime-step";

export type GraphEdgeKind =
  | "contains"
  | "imports"
  | "exports"
  | "calls"
  | "depends-on"
  | "executes"
  | "reads"
  | "writes"
  | "reports-to";

export type GraphNodeState =
  | "idle"
  | "queued"
  | "active"
  | "success"
  | "failed"
  | "warning";

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  path?: string;
  parentId?: string;
  state: GraphNodeState;
  metadata?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  state: GraphNodeState;
  metadata?: Record<string, unknown>;
};

export type GraphSnapshot = {
  version: "1.0";
  projectRoot: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphEventType =
  | "node.queued"
  | "node.active"
  | "node.success"
  | "node.failed"
  | "node.warning"
  | "edge.active"
  | "edge.success"
  | "edge.failed";

export type GraphEvent = {
  id: string;
  jobId?: string;
  missionId?: string;
  workflowId?: string;
  taskId?: string;
  stepIndex?: number;
  driverId?: string;
  type: GraphEventType;
  nodeId?: string;
  edgeId?: string;
  time: string;
  metadata?: Record<string, unknown>;
};
