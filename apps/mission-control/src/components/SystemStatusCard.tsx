import { useRuntime } from "../state/RuntimeContext.js";

export function SystemStatusCard() {
  const { runtime } = useRuntime();
  const statusItems = [
    { label: "Runtime", value: runtime.runtime },
    { label: "Browser", value: runtime.browser },
    { label: "Mission", value: runtime.mission },
    { label: "Drivers", value: String(runtime.drivers) },
    { label: "Queue", value: String(runtime.queue) }
  ];
  return (
    <article className="panel system-status-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SYSTEM STATUS</p>
          <h2>Runtime overview</h2>
        </div>
      </div>

      <div className="metric-grid">
        {statusItems.map((item) => (
          <div className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
