import { useEffect, useMemo, useState } from "react";

type GitFile = { indexStatus: string; workTreeStatus: string; path: string };
type GitCommit = { hash: string; shortHash: string; author: string; authoredAt: string; subject: string };
type GitSummary = { branch: string; detached: boolean; clean: boolean; stagedCount: number; modifiedCount: number; untrackedCount: number; files: GitFile[]; recentCommits: GitCommit[] };

export function GitWorkspace() {
  const [git, setGit] = useState<GitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const response = await fetch("/api/git", { cache: "no-store" });
        if (!response.ok) throw new Error(`Git API returned ${response.status}`);
        const payload = await response.json();
        if (!disposed) { setGit(payload.git ?? null); setError(null); }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load Git telemetry");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const files = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? (git?.files ?? []).filter((file) => file.path.toLowerCase().includes(normalized)) : (git?.files ?? []);
  }, [git, query]);

  return <section className="git-workspace" aria-labelledby="git-workspace-title">
    <header className="section-workspace-heading"><div><p className="eyebrow">SOURCE CONTROL</p><h2 id="git-workspace-title">Git</h2></div><p>Read-only repository status and recent commit history.</p></header>
    <div className="git-summary-grid">
      <article className="panel git-branch-card"><p className="eyebrow">CURRENT BRANCH</p><strong>{git?.branch ?? "Unavailable"}</strong><span>{error ?? (git?.clean ? "Working tree clean" : "Working tree has changes")}</span></article>
      <article className="panel git-metric-card"><span>Staged</span><strong>{git?.stagedCount ?? 0}</strong></article>
      <article className="panel git-metric-card"><span>Modified</span><strong>{git?.modifiedCount ?? 0}</strong></article>
      <article className="panel git-metric-card"><span>Untracked</span><strong>{git?.untrackedCount ?? 0}</strong></article>
    </div>
    <div className="git-grid">
      <article className="panel"><div className="git-panel-heading"><div><p className="eyebrow">WORKING TREE</p><h3>Changed files</h3></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter paths" /></div><div className="git-file-list">{files.length === 0 ? <p>No matching changed files.</p> : files.map((file) => <div className="git-file-row" key={file.indexStatus+file.workTreeStatus+file.path}><code>{file.indexStatus}{file.workTreeStatus}</code><span>{file.path}</span></div>)}</div></article>
      <article className="panel"><div className="git-panel-heading"><div><p className="eyebrow">HISTORY</p><h3>Recent commits</h3></div></div><div className="git-commit-list">{(git?.recentCommits ?? []).map((commit) => <div className="git-commit-row" key={commit.hash}><code>{commit.shortHash}</code><div><strong>{commit.subject}</strong><span>{commit.author} · {new Date(commit.authoredAt).toLocaleString()}</span></div></div>)}</div></article>
    </div>
  </section>;
}
