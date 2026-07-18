import { useEffect, useMemo, useState } from "react";

type MemorySummary = {
  id: string;
  category: string;
  missionId: string | null;
  status: string | null;
  updatedAt: string | null;
  resumeTokenPresent: boolean;
  autonomousStep: number | null;
  keyCount: number;
  sourcePath: string;
};

export function MemoryWorkspace() {
  const [memory, setMemory] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/memory", { cache: "no-store" });
        if (!response.ok) throw new Error(`Memory API returned ${response.status}`);
        const payload = await response.json();
        if (!disposed) {
          setMemory(Array.isArray(payload.memory) ? payload.memory : []);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load persisted memory summaries");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const categories = useMemo(() => [...new Set(memory.map((entry) => entry.category))].sort(), [memory]);
  const visibleMemory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return memory.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!normalized) return true;
      return [entry.id, entry.category, entry.missionId ?? "", entry.status ?? "", entry.sourcePath]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [category, memory, query]);

  const missionCount = new Set(memory.map((entry) => entry.missionId).filter(Boolean)).size;
  const continuationCount = memory.filter((entry) => entry.category === "continuation").length;
  const tokenCount = memory.filter((entry) => entry.resumeTokenPresent).length;

  return (
    <section className="memory-workspace" aria-labelledby="memory-workspace-title">
      <header className="section-workspace-heading">
        <div><p className="eyebrow">PERSISTED CONTEXT</p><h2 id="memory-workspace-title">Memory</h2></div>
        <p>Read-only summaries of mission state, continuation checkpoints and persisted runtime context.</p>
      </header>

      <div className="memory-summary-grid">
        <article className="panel"><span>Records</span><strong>{loading ? "…" : memory.length}</strong></article>
        <article className="panel"><span>Missions</span><strong>{missionCount}</strong></article>
        <article className="panel"><span>Continuations</span><strong>{continuationCount}</strong></article>
        <article className="panel"><span>Resume tokens</span><strong>{tokenCount}</strong><small>{error ?? "Token values are never exposed"}</small></article>
      </div>

      <div className="memory-toolbar panel">
        <label><span>Search memory</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mission, category, status or path" /></label>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>

      <div className="memory-grid">
        {!loading && visibleMemory.length === 0 ? <article className="panel memory-empty">No matching persisted memory records were found.</article> : null}
        {visibleMemory.map((entry) => (
          <article className="panel memory-card" key={entry.id + entry.sourcePath}>
            <div className="memory-card-heading"><span className="active-badge">{entry.category}</span><span>{entry.status ?? "Stored"}</span></div>
            <h3>{entry.missionId ?? entry.id}</h3>
            <dl>
              <div><dt>Updated</dt><dd>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "—"}</dd></div>
              <div><dt>Autonomous step</dt><dd>{entry.autonomousStep ?? "—"}</dd></div>
              <div><dt>Resume token</dt><dd>{entry.resumeTokenPresent ? "Present" : "Not present"}</dd></div>
              <div><dt>Top-level keys</dt><dd>{entry.keyCount}</dd></div>
            </dl>
            <code title={entry.sourcePath}>{entry.sourcePath}</code>
          </article>
        ))}
      </div>
    </section>
  );
}
