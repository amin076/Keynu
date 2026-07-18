import Header from "./Header.js";
import { MissionOverview } from "./MissionOverview.js";
import { RuntimeHealth } from "./RuntimeHealth.js";
import { RecentActivityCard } from "./RecentActivityCard.js";
import RuntimePanel from "./RuntimePanel.js";
import BrowserPanel from "./BrowserPanel.js";
import MissionPanel from "./MissionPanel.js";
import DriverPanel from "./DriverPanel.js";
import QueuePanel from "./QueuePanel.js";
import { KnowledgeGraphWorkspace } from "./KnowledgeGraphWorkspace.js";
import { RuntimeWorkspace } from "./RuntimeWorkspace.js";
import { MissionsWorkspace } from "./MissionsWorkspace.js";
import { DriversWorkspace } from "./DriversWorkspace.js";
import { ProcessesWorkspace } from "./ProcessesWorkspace.js";
import { GitWorkspace } from "./GitWorkspace.js";
import { ReportsWorkspace } from "./ReportsWorkspace.js";
import { MemoryWorkspace } from "./MemoryWorkspace.js";
import { dashboardSections } from "../state/DashboardState.js";
import { useDashboardState } from "../hooks/useDashboardState.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type LayoutProps = {
  runtime: RuntimeSnapshot;
};

export default function Layout({ runtime }: LayoutProps) {
  const { activeSection } = useDashboardState();
  const activeLabel =
    dashboardSections.find((section) => section.id === activeSection)?.label ?? "Overview";

  return (
    <main className="mission-layout">
      <Header runtime={runtime} />

      {activeSection === "overview" ? (
        <>
          <section
            className="mission-overview-workspace"
            aria-label="Mission overview workspace"
          >
            <MissionOverview />
            <RuntimeHealth />
            <RecentActivityCard />
          </section>

          <section className="mission-grid" aria-label="Keynu runtime overview">
            <RuntimePanel runtime={runtime} />
            <BrowserPanel runtime={runtime} />
            <MissionPanel runtime={runtime} />
            <DriverPanel runtime={runtime} />
            <QueuePanel runtime={runtime} />
          </section>
        </>
      ) : activeSection === "missions" ? (
        <MissionsWorkspace runtime={runtime} />
      ) : activeSection === "knowledge-graph" ? (
        <KnowledgeGraphWorkspace />
      ) : activeSection === "memory" ? (
        <MemoryWorkspace />
      ) : activeSection === "reports" ? (
        <ReportsWorkspace />
      ) : activeSection === "git" ? (
        <GitWorkspace />
      ) : activeSection === "processes" ? (
        <ProcessesWorkspace />
      ) : activeSection === "drivers" ? (
        <DriversWorkspace runtime={runtime} />
      ) : activeSection === "runtime" ? (
        <RuntimeWorkspace runtime={runtime} />
      ) : (
        <section
          className="panel section-placeholder"
          aria-labelledby="section-placeholder-title"
        >
          <p className="eyebrow">DASHBOARD SECTION</p>
          <h2 id="section-placeholder-title">{activeLabel}</h2>
          <p>
            This workspace is registered in navigation and will be connected in a
            dedicated mission step.
          </p>
        </section>
      )}
    </main>
  );
}

