const nodes = [
  { label: "Mission", type: "mission", x: 50, y: 18 },
  { label: "Runtime", type: "runtime", x: 29, y: 48 },
  { label: "Knowledge Graph", type: "graph", x: 51, y: 52 },
  { label: "Browser Agent", type: "agent", x: 72, y: 47 },
  { label: "Memory", type: "memory", x: 20, y: 78 },
  { label: "Recommendations", type: "recommendation", x: 51, y: 82 },
  { label: "Reports", type: "report", x: 81, y: 77 },
];

export function KnowledgeGraphWorkspace() {
  return (
    <article className="panel graph-panel">
      <div className="graph-toolbar">
        <div>
          <p className="eyebrow">KNOWLEDGE WORKSPACE</p>
          <h2>Interactive system graph</h2>
        </div>
        <div className="toolbar-actions">
          <button type="button">2D</button>
          <button type="button">3D</button>
          <button type="button">Fit view</button>
          <input aria-label="Search graph" placeholder="Search nodes…" />
        </div>
      </div>

      <div className="graph-layout">
        <div className="graph-canvas" role="img" aria-label="Preview of the Keynu knowledge graph">
          <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="50" y1="18" x2="29" y2="48" />
            <line x1="50" y1="18" x2="51" y2="52" />
            <line x1="50" y1="18" x2="72" y2="47" />
            <line x1="29" y1="48" x2="20" y2="78" />
            <line x1="51" y1="52" x2="51" y2="82" />
            <line x1="72" y1="47" x2="81" y2="77" />
          </svg>

          {nodes.map((node) => (
            <button
              className={`graph-node graph-node-${node.type}`}
              key={node.label}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              type="button"
            >
              <span />
              <strong>{node.label}</strong>
              <small>{node.type}</small>
            </button>
          ))}

          <div className="graph-legend">
            <span><i className="legend-mission" />Mission</span>
            <span><i className="legend-runtime" />Runtime</span>
            <span><i className="legend-graph" />Graph</span>
            <span><i className="legend-agent" />Agent</span>
          </div>
        </div>

        <aside className="inspector">
          <p className="eyebrow">NODE INSPECTOR</p>
          <h3>Mission</h3>
          <span className="inspector-type">MISSION NODE</span>
          <dl>
            <div><dt>Status</dt><dd>Active</dd></div>
            <div><dt>Milestone</dt><dd>Application shell</dd></div>
            <div><dt>Connected nodes</dt><dd>3</dd></div>
            <div><dt>Last update</dt><dd>Just now</dd></div>
          </dl>
          <button className="primary-action" type="button">Open mission details</button>
        </aside>
      </div>
    </article>
  );
}
