import type { ReactNode } from "react";
import { dashboardSections } from "../state/DashboardState.js";
import { useDashboardState } from "../hooks/useDashboardState.js";

export function AppShell({ children }: { children: ReactNode }) {
  const {
    activeSection,
    sidebarOpen,
    setActiveSection,
    setSidebarOpen,
    toggleSidebar
  } = useDashboardState();

  const activeLabel =
    dashboardSections.find((section) => section.id === activeSection)?.label ?? "Overview";

  return (
    <div className={sidebarOpen ? "app-shell sidebar-is-open" : "app-shell"}>
      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="sidebar" aria-label="Mission Control navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">K</span>
          <div>
            <strong>KEYNU</strong>
            <span>Mission Control</span>
          </div>
        </div>

        <nav className="primary-navigation" aria-label="Primary navigation">
          {dashboardSections.map((section) => (
            <button
              className={section.id === activeSection ? "nav-item active" : "nav-item"}
              key={section.id}
              type="button"
              aria-current={section.id === activeSection ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="nav-indicator" aria-hidden="true" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="connection-dot" aria-hidden="true" />
          <div>
            <strong>Runtime connected</strong>
            <span>Browser Agent online</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
              onClick={toggleSidebar}
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <p className="eyebrow">MISSION CONTROL</p>
              <h1>{activeLabel}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="command-button" type="button" disabled>
              Command palette
              <kbd>Ctrl K</kbd>
            </button>
            <span className="system-status">System nominal</span>
          </div>
        </header>

        <div className="content-area">{children}</div>
      </main>
    </div>
  );
}
