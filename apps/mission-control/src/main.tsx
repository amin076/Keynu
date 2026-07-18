import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { DashboardStateProvider } from "./state/DashboardState.js";
import { RuntimeProvider } from "./state/RuntimeContext.js";
import "./styles.css";
import "./component-styles.css";

const rootElement = document.getElementById("keynu-mission-control-root");

if (!rootElement) {
  throw new Error("Missing #keynu-mission-control-root element.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <DashboardStateProvider>
      <RuntimeProvider>
        <App />
      </RuntimeProvider>
    </DashboardStateProvider>
  </React.StrictMode>
);
