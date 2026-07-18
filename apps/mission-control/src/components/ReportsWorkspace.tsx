import { useEffect, useMemo, useState } from "react";

type ReportSummary = {
  id: string;
  jobId: string;
  type: string;
  status: string;
  createdAt: string;
  target: string;
  verificationStatus: string | null;
  certificateStatus: string | null;
  sourcePath: string;
};

export function ReportsWorkspace() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/reports", { cache: "no-store" });
        if (!response.ok) throw new Error(`Reports API returned ${response.status}`);
        const payload = await response.json();
        if (!disposed) {
          setReports(Array.isArray(payload.reports) ? payload.reports : []);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load persisted reports");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      const reportStatus = report.status.toLowerCase();
      const verification = (report.verificationStatus ?? report.certificateStatus ?? "").toLowerCase();
      if (status !== "all" && reportStatus !== status && verification !== status) return false;
      if (!normalized) return true;
      return [report.id, report.jobId, report.type, report.status, report.target, report.sourcePath]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, reports, status]);

  const verifiedCount = reports.filter((report) =>
    report.verificationStatus === "VERIFIED" || report.certificateStatus === "VERIFIED"
  ).length;
  const failedCount = reports.filter((report) => report.status === "FAILED").length;

  return (
    <section className="reports-workspace" aria-labelledby="reports-workspace-title">
      <header className="section-workspace-heading">
        <div><p className="eyebrow">EXECUTION EVIDENCE</p><h2 id="reports-workspace-title">Reports</h2></div>
        <p>Read-only summaries of persisted KAP reports and verification evidence.</p>
      </header>

      <div className="reports-summary-grid">
        <article className="panel"><span>Total reports</span><strong>{loading ? "…" : reports.length}</strong></article>
        <article className="panel"><span>Verified</span><strong>{verifiedCount}</strong></article>
        <article className="panel"><span>Failed</span><strong>{failedCount}</strong></article>
        <article className="panel"><span>Telemetry</span><strong>Read only</strong><small>{error ?? "Refreshes every ten seconds"}</small></article>
      </div>

      <div className="reports-toolbar panel">
        <label><span>Search reports</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job, status or source path" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="verified">Verified</option></select></label>
      </div>

      <div className="reports-table-wrap panel">
        <table className="reports-table">
          <thead><tr><th>Created</th><th>Job</th><th>Status</th><th>Verification</th><th>Target</th><th>Source</th></tr></thead>
          <tbody>
            {!loading && visibleReports.length === 0 ? <tr><td colSpan={6}>No matching persisted reports were found.</td></tr> : null}
            {visibleReports.map((report) => (
              <tr key={report.id + report.sourcePath}>
                <td>{report.createdAt ? new Date(report.createdAt).toLocaleString() : "—"}</td>
                <td><strong>{report.jobId || report.id}</strong><small>{report.type}</small></td>
                <td><span className="active-badge">{report.status}</span></td>
                <td>{report.verificationStatus ?? report.certificateStatus ?? "—"}</td>
                <td>{report.target || "—"}</td>
                <td><code title={report.sourcePath}>{report.sourcePath}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
