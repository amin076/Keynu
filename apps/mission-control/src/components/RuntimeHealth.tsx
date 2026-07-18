import { useRuntime } from "../state/RuntimeContext.js";

export function RuntimeHealth() {
  const { runtime } = useRuntime();

  const metrics = [
    ["Runtime", runtime.runtime],
    ["Browser", runtime.browser],
    ["Drivers", String(runtime.drivers) + " ready"],
    ["Queue", String(runtime.queue) + " waiting"]
  ];

  return (
    <article className="panel runtime-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE SYSTEM</p>
          <h2>Runtime health</h2>
        </div>
        <span
          className="pulse"
          role="status"
          aria-label={"Runtime data updated " + runtime.updatedAt}
        />
      </div>

      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
