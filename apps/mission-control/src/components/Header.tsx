import type { RuntimeSnapshot } from "../state/RuntimeStore.js";

export type HeaderProps = {
  runtime: RuntimeSnapshot;
};

export default function Header({ runtime }: HeaderProps) {
  const updatedAt = new Date(runtime.updatedAt);
  const updatedLabel = Number.isNaN(updatedAt.getTime())
    ? "Unknown"
    : updatedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

  const runtimeOnline = runtime.runtime.toLowerCase() === "online" ||
    runtime.runtime.toLowerCase() === "healthy";

  return (
    <header className="mission-header">
      <div className="mission-header__identity">
        <span className="mission-header__mark" aria-hidden="true">K</span>
        <div>
          <p className="mission-header__eyebrow">KEYNU OPERATIONS</p>
          <h1>Mission Control</h1>
        </div>
      </div>

      <div className="mission-header__status" aria-label="Runtime status">
        <span
          className={runtimeOnline ? "status-dot status-dot--online" : "status-dot"}
          aria-hidden="true"
        />
        <div>
          <strong>{runtime.runtime}</strong>
          <span>Updated {updatedLabel}</span>
        </div>
      </div>
    </header>
  );
}
