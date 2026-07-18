import { strict as assert } from "node:assert";
import { once } from "node:events";
import { DriverManager } from "../../core/DriverManager.js";
import { startDashboardServer } from "../dashboardServer.js";

const driverManager = new DriverManager();
const dashboard = await startDashboardServer({
  driverManager,
  capabilities: [],
  port: 0,
});

assert(dashboard);

try {
  const response = await fetch(dashboard.url + "/api/graph/operational-insights");
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.ok, true);
  assert(body.operationalInsights);
  assert(body.operationalInsights.counts);
  assert(Array.isArray(body.operationalInsights.insights));
  assert(Array.isArray(body.operationalInsights.unresolvedFailedJobs));
  assert(Array.isArray(body.operationalInsights.recoveredFailedJobs));
} finally {
  await dashboard.close();
}

console.log("Operational insights live HTTP tests passed.");
