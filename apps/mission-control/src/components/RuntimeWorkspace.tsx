import { RuntimeHealth } from "./RuntimeHealth.js";
import RuntimePanel from "./RuntimePanel.js";
import BrowserPanel from "./BrowserPanel.js";
import DriverPanel from "./DriverPanel.js";
import QueuePanel from "./QueuePanel.js";
import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type RuntimeWorkspaceProps = {
  runtime: RuntimeSnapshot;
};

export function RuntimeWorkspace({ runtime }: RuntimeWorkspaceProps) {
  return (
    <section className="runtime-workspace" aria-labelledby="runtime-workspace-title">
      <header className="section-workspace-heading">
        <div>
          <p className="eyebrow">LIVE OPERATIONS</p>
          <h2 id="runtime-workspace-title">Runtime</h2>
        </div>
        <p>Live runtime, browser, driver and queue telemetry from Keynu.</p>
      </header>

      <RuntimeHealth />

      <div className="mission-grid" aria-label="Runtime subsystem status">
        <RuntimePanel runtime={runtime} />
        <BrowserPanel runtime={runtime} />
        <DriverPanel runtime={runtime} />
        <QueuePanel runtime={runtime} />
      </div>
    </section>
  );
}
