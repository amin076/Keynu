import type { ReactNode } from 'react';
import { SystemStatusCard } from './SystemStatusCard.js';
import { RecentActivityCard } from './RecentActivityCard.js';

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <section className="workspace-layout">
      <div className="workspace-main">{children}</div>
      <aside className="workspace-sidebar">
        <SystemStatusCard />
        <RecentActivityCard />
      </aside>
    </section>
  );
}
