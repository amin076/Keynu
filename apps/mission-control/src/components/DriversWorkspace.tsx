import { useEffect, useState } from "react";
import DriverPanel from "./DriverPanel.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

type DriverSummary = { id: string; name: string; status: string; capabilities: string[] };

export function DriversWorkspace({ runtime }: { runtime: RuntimeSnapshot }) {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/drivers", { cache: "no-store" });
        if (!response.ok) throw new Error(`Driver API returned ${response.status}`);
        const payload = await response.json();
        if (!disposed) {
          setDrivers(Array.isArray(payload.drivers) ? payload.drivers : []);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load drivers");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  return (
    <section className="drivers-workspace" aria-labelledby="drivers-workspace-title">
      <header className="section-workspace-heading">
        <div><p className="eyebrow">CONNECTED CAPABILITIES</p><h2 id="drivers-workspace-title">Drivers</h2></div>
        <p>Live registered Keynu integrations and their declared capabilities.</p>
      </header>
      <div className="drivers-workspace-summary">
        <DriverPanel runtime={runtime} />
        <article className="panel drivers-count-card">
          <p className="eyebrow">ENUMERATED RECORDS</p>
          <strong>{loading ? "…" : drivers.length}</strong>
          <span>{error ?? "Refreshed every five seconds"}</span>
        </article>
      </div>
      <div className="drivers-list" aria-live="polite">
        {!loading && drivers.length === 0 ? <article className="panel drivers-empty-state"><h3>No detailed driver records</h3><p>The aggregate runtime count remains available, but no registered metadata was returned.</p></article> : null}
        {drivers.map((driver) => <article className="panel driver-detail-card" key={driver.id}><div className="driver-detail-card__heading"><div><p className="eyebrow">{driver.id}</p><h3>{driver.name}</h3></div><span className="active-badge">{driver.status}</span></div><div className="driver-capabilities">{driver.capabilities.length ? driver.capabilities.map((capability) => <span key={capability}>{capability}</span>) : <span>No declared capabilities</span>}</div></article>)}
      </div>
    </section>
  );
}
