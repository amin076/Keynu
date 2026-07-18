import MissionPanel from "./MissionPanel.js";
import { MissionOverview } from "./MissionOverview.js";
import { RecentActivityCard } from "./RecentActivityCard.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type MissionsWorkspaceProps = {
  runtime: RuntimeSnapshot;
};

export function MissionsWorkspace({ runtime }: MissionsWorkspaceProps) {
  return (
    <section className="missions-workspace" aria-labelledby="missions-workspace-title">
      <header className="section-workspace-heading">
        <div>
          <p className="eyebrow">MISSION OPERATIONS</p>
          <h2 id="missions-workspace-title">Missions</h2>
        </div>
        <p>Current mission state, execution context and recent mission activity.</p>
      </header>

      <div className="missions-workspace-grid">
        <MissionOverview />
        <MissionPanel runtime={runtime} />
        <RecentActivityCard />
      </div>
    </section>
  );
}
