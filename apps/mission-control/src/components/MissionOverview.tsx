export function MissionOverview() {
  return (
    <article className="panel mission-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CURRENT MISSION</p>
          <h2>React Mission Control Dashboard</h2>
        </div>
        <span className="active-badge">ACTIVE</span>
      </div>

      <p className="mission-copy">
        Replace the prototype dashboard with a readable, interactive and responsive
        operations workspace.
      </p>

      <div className="progress-row">
        <div className="progress-track" aria-label="Mission progress">
          <span style={{ width: "8%" }} />
        </div>
        <strong>8%</strong>
      </div>

      <dl className="mission-facts">
        <div>
          <dt>Current milestone</dt>
          <dd>React architecture and application shell</dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>Connect the shell to live Dashboard APIs</dd>
        </div>
      </dl>
    </article>
  );
}
