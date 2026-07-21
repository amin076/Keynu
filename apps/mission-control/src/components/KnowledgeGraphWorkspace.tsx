import { useCallback, useEffect, useMemo, useState } from 'react';
import { missionControlApi } from '../api/httpClient.js';
import type {
  EffectiveGraphEdgesContract,
  EffectiveGraphImpactContract,
  EffectiveGraphNeighborsContract,
  EffectiveGraphNodesContract,
  EffectiveGraphSummaryContract,
  GraphEdgeContract,
  GraphNodeContract,
  GraphNodeKind,
} from '../api/contracts.js';

const NODE_LIMIT = 80;
const EDGE_LIMIT = 150;
const graphKinds: Array<GraphNodeKind | ''> = [
  '',
  'project',
  'folder',
  'file',
  'driver',
  'job',
  'command',
  'report',
];

type PositionedNode = GraphNodeContract & { x: number; y: number };

export function KnowledgeGraphWorkspace() {
  const [nodes, setNodes] = useState<GraphNodeContract[]>([]);
  const [edges, setEdges] = useState<GraphEdgeContract[]>([]);
  const [summary, setSummary] = useState<EffectiveGraphSummaryContract['graph'] | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<GraphNodeContract[]>([]);
  const [impactedNodes, setImpactedNodes] = useState<GraphNodeContract[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<GraphNodeKind | ''>('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);

    const nodeQuery = new URLSearchParams({ limit: String(NODE_LIMIT) });
    if (search.trim()) nodeQuery.set('search', search.trim());
    if (kind) nodeQuery.set('kind', kind);

    try {
      const [nodeResponse, edgeResponse, summaryResponse] = await Promise.all([
        missionControlApi.get<EffectiveGraphNodesContract>(
          `/api/graph/effective/nodes?${nodeQuery.toString()}`,
          { cache: 'no-store' },
        ),
        missionControlApi.get<EffectiveGraphEdgesContract>(
          `/api/graph/effective/edges?limit=${EDGE_LIMIT}`,
          { cache: 'no-store' },
        ),
        missionControlApi.get<EffectiveGraphSummaryContract>(
          '/api/graph/effective/summary',
          { cache: 'no-store' },
        ),
      ]);

      setNodes(nodeResponse.items);
      setEdges(edgeResponse.items);
      setSummary(summaryResponse.graph);
      setSelectedNodeId((current) => {
        if (current && nodeResponse.items.some((node) => node.id === current)) return current;
        return nodeResponse.items[0]?.id ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setNodes([]);
      setEdges([]);
      setSummary(null);
      setSelectedNodeId(null);
    } finally {
      setLoading(false);
    }
  }, [kind, refreshToken, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadGraph(), 180);
    return () => window.clearTimeout(timeout);
  }, [loadGraph]);

  useEffect(() => {
    if (!selectedNodeId) {
      setNeighbors([]);
      setImpactedNodes([]);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    const encoded = encodeURIComponent(selectedNodeId);
    void Promise.all([
      missionControlApi.get<EffectiveGraphNeighborsContract>(
        `/api/graph/effective/neighbors?nodeId=${encoded}&depth=1`,
        { cache: 'no-store' },
      ),
      missionControlApi.get<EffectiveGraphImpactContract>(
        `/api/graph/effective/impact?nodeId=${encoded}&depth=4`,
        { cache: 'no-store' },
      ),
    ])
      .then(([neighborResponse, impactResponse]) => {
        if (cancelled) return;
        setNeighbors(neighborResponse.nodes);
        setImpactedNodes(impactResponse.impactedNodes);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const positionedNodes = useMemo(() => positionNodes(nodes), [nodes]);
  const positionedById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const visibleEdges = useMemo(
    () => edges.filter((edge) => positionedById.has(edge.source) && positionedById.has(edge.target)),
    [edges, positionedById],
  );

  return (
    <article className="panel graph-panel">
      <div className="graph-toolbar">
        <div>
          <p className="eyebrow">KNOWLEDGE WORKSPACE</p>
          <h2>Live effective graph</h2>
          <p className="graph-subtitle">
            Repository structure combined with runtime jobs, drivers, commands, reports, and state.
          </p>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <select
            aria-label="Filter graph by node kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as GraphNodeKind | '')}
          >
            {graphKinds.map((value) => (
              <option key={value || 'all'} value={value}>{value || 'All kinds'}</option>
            ))}
          </select>
          <input
            aria-label="Search graph"
            placeholder="Search nodes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {summary && (
        <div className="graph-summary" aria-label="Effective graph summary">
          <span><strong>{summary.nodeCount}</strong> nodes</span>
          <span><strong>{summary.edgeCount}</strong> edges</span>
          <span><strong>{summary.nodeStates.active ?? 0}</strong> active</span>
          <span><strong>{summary.nodeStates.failed ?? 0}</strong> failed</span>
          <span><strong>{summary.projection.matchedRepositoryEvents}</strong> matched events</span>
        </div>
      )}

      {error && <div className="graph-error" role="alert">{error}</div>}

      <div className="graph-layout">
        <div className="graph-canvas" aria-label="Live Keynu effective graph">
          {loading && <div className="graph-empty-state">Loading graph data…</div>}
          {!loading && nodes.length === 0 && !error && (
            <div className="graph-empty-state">No graph nodes match the current filters.</div>
          )}

          <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleEdges.map((edge) => {
              const source = positionedById.get(edge.source);
              const target = positionedById.get(edge.target);
              if (!source || !target) return null;
              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  data-kind={edge.kind}
                  data-state={edge.state}
                />
              );
            })}
          </svg>

          {positionedNodes.map((node) => (
            <button
              className={`graph-node graph-node-${node.kind} ${selectedNodeId === node.id ? 'is-selected' : ''}`}
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              type="button"
              title={node.path ?? node.id}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <span data-state={node.state} />
              <strong>{node.label}</strong>
              <small>{node.kind} · {node.state}</small>
            </button>
          ))}
        </div>

        <aside className="inspector" aria-live="polite">
          <p className="eyebrow">NODE INSPECTOR</p>
          {!selectedNode && <p>Select a node to inspect its runtime relationships.</p>}
          {selectedNode && (
            <>
              <h3>{selectedNode.label}</h3>
              <span className="inspector-type">{selectedNode.kind.toUpperCase()} NODE</span>
              <dl>
                <div><dt>Status</dt><dd>{selectedNode.state}</dd></div>
                <div><dt>Path</dt><dd>{selectedNode.path ?? '—'}</dd></div>
                <div><dt>Neighbors</dt><dd>{detailLoading ? '…' : neighbors.length}</dd></div>
                <div><dt>Impact</dt><dd>{detailLoading ? '…' : impactedNodes.length}</dd></div>
              </dl>
              <section className="inspector-list">
                <h4>Connected nodes</h4>
                {neighbors.slice(0, 8).map((node) => (
                  <button type="button" key={node.id} onClick={() => setSelectedNodeId(node.id)}>
                    <span>{node.kind}</span>
                    <strong>{node.label}</strong>
                  </button>
                ))}
                {!detailLoading && neighbors.length === 0 && <small>No direct neighbors.</small>}
              </section>
              <section className="inspector-list">
                <h4>Impacted nodes</h4>
                {impactedNodes.slice(0, 8).map((node) => (
                  <button type="button" key={node.id} onClick={() => setSelectedNodeId(node.id)}>
                    <span>{node.kind}</span>
                    <strong>{node.label}</strong>
                  </button>
                ))}
                {!detailLoading && impactedNodes.length === 0 && <small>No dependency impact found.</small>}
              </section>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}

function positionNodes(nodes: GraphNodeContract[]): PositionedNode[] {
  if (nodes.length === 0) return [];

  const columns = Math.max(3, Math.ceil(Math.sqrt(nodes.length * 1.6)));
  const rows = Math.ceil(nodes.length / columns);
  const xPadding = 8;
  const yPadding = 10;

  return nodes.map((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const xStep = columns > 1 ? (100 - xPadding * 2) / (columns - 1) : 0;
    const yStep = rows > 1 ? (100 - yPadding * 2) / (rows - 1) : 0;

    return {
      ...node,
      x: xPadding + column * xStep,
      y: yPadding + row * yStep,
    };
  });
}
