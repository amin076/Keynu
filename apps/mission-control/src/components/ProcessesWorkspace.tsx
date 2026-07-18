import { useEffect, useMemo, useState } from "react";

type ProcessSummary = {
  pid: number;
  parentPid: number | null;
  name: string;
  commandLine: string;
  status: string;
};

export function ProcessesWorkspace() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/processes", { cache: "no-store" });
        if (!response.ok) throw new Error(`Processes API returned ${response.status}`);
        const payload = await response.json();
        if (!disposed) {
          setProcesses(Array.isArray(payload.processes) ? payload.processes : []);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load processes");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const visibleProcesses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return processes;
    return processes.filter((process) =>
      [process.name, process.commandLine, String(process.pid), String(process.parentPid ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [processes, query]);

  return (
    <section className="processes-workspace" aria-labelledby="processes-workspace-title">
      <header className="section-workspace-heading">
        <div>
          <p className="eyebrow">RUNTIME OBSERVABILITY</p>
          <h2 id="processes-workspace-title">Processes</h2>
        </div>
        <p>Read-only visibility into active Keynu-related operating-system processes.</p>
      </header>

      <div className="processes-toolbar panel">
        <div>
          <p className="eyebrow">DISCOVERED PROCESSES</p>
          <strong>{loading ? "…" : processes.length}</strong>
          <span>{error ?? "Refreshed every five seconds"}</span>
        </div>
        <label>
          <span>Filter processes</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, PID or command"
            type="search"
          />
        </label>
      </div>

      <div className="processes-table-wrap panel">
        <table className="processes-table">
          <thead>
            <tr>
              <th>Process</th>
              <th>PID</th>
              <th>Parent</th>
              <th>Status</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
            {!loading && visibleProcesses.length === 0 ? (
              <tr><td colSpan={5}>No matching Keynu-related processes were returned.</td></tr>
            ) : null}
            {visibleProcesses.map((process) => (
              <tr key={process.pid}>
                <td><strong>{process.name}</strong></td>
                <td>{process.pid}</td>
                <td>{process.parentPid ?? "—"}</td>
                <td><span className="active-badge">{process.status}</span></td>
                <td><code title={process.commandLine}>{process.commandLine || "—"}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
