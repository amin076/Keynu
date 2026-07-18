import { useContext } from "react";
import { DashboardStateContext } from "../state/DashboardState.js";

export function useDashboardState() {
  const context = useContext(DashboardStateContext);

  if (!context) {
    throw new Error("useDashboardState must be used within DashboardStateProvider.");
  }

  return context;
}
