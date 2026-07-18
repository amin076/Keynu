import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";

export const dashboardSections = [
  { id: "overview", label: "Overview" },
  { id: "missions", label: "Missions" },
  { id: "knowledge-graph", label: "Knowledge Graph" },
  { id: "runtime", label: "Runtime" },
  { id: "recommendations", label: "Recommendations" },
  { id: "memory", label: "Memory" },
  { id: "drivers", label: "Drivers" },
  { id: "processes", label: "Processes" },
  { id: "reports", label: "Reports" },
  { id: "git", label: "Git" }
] as const;

export type DashboardSectionId = (typeof dashboardSections)[number]["id"];

export type DashboardStateValue = {
  activeSection: DashboardSectionId;
  sidebarOpen: boolean;
  setActiveSection: (section: DashboardSectionId) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const DashboardStateContext = createContext<DashboardStateValue | null>(null);

export function DashboardStateProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSectionState] = useState<DashboardSectionId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const setActiveSection = useCallback((section: DashboardSectionId) => {
    setActiveSectionState(section);
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => !current);
  }, []);

  const value = useMemo<DashboardStateValue>(
    () => ({
      activeSection,
      sidebarOpen,
      setActiveSection,
      setSidebarOpen,
      toggleSidebar
    }),
    [activeSection, sidebarOpen, setActiveSection, toggleSidebar]
  );

  return (
    <DashboardStateContext.Provider value={value}>
      {children}
    </DashboardStateContext.Provider>
  );
}
