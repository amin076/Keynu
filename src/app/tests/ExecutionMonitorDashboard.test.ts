import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { DriverManager } from '../../core/DriverManager.js';
import { startDashboardServer } from '../dashboardServer.js';
import { ExecutionPlanStore } from '../../mission/execution/ExecutionPlanStore.js';

const root = await mkdtemp(join(tmpdir(), 'keynu-dashboard-monitor-'));
const previous = process.env.KEYNU_EXECUTION_STATE_DIR;
process.env.KEYNU_EXECUTION_STATE_DIR = join(root, 'state');
const store = new ExecutionPlanStore(process.env.KEYNU_EXECUTION_STATE_DIR);
await store.add({ id: 'dashboard-fixture', projectId: 'esbiko-fixture', projectRoot: root, goal: 'Inspect simulation evidence', steps: [
  { id: 'audit', goal: 'Read simulation sources', allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }] },
  { id: 'develop', goal: 'Apply verified improvement', dependsOn: ['audit'], allowedFunctions: ['project.list'], verification: [{ name: 'project.list', args: {} }] },
] });
await store.update('dashboard-fixture', 'audit', { status: 'BLOCKED', reason: 'Fixture needs evidence' });
const dashboard = await startDashboardServer({ driverManager: new DriverManager(), capabilities: [], port: 0 });
assert(dashboard);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const response = await fetch(`${dashboard.url}/api/execution-monitor`);
  assert.equal(response.status, 200);
  const monitor = await response.json() as any;
  assert.deepEqual(monitor.plans[0].steps[1].alerts, ['DEPENDENCY_REQUIRES_ATTENTION']);
  assert.equal((await fetch(`${dashboard.url}/api/execution-monitor`, { method: 'POST' })).status, 405);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(dashboard.url);
  await page.getByRole('button', { name: 'Missions', exact: true }).click();
  await page.getByText('Fixture needs evidence', { exact: true }).waitFor();
  const panel = page.locator('.execution-plans-panel');
  assert.match(await panel.innerText(), /esbiko-fixture/);
  assert.match(await panel.innerText(), /Waiting for: audit/);
  await store.update('dashboard-fixture', 'audit', { status: 'COMPLETED', reason: 'Fixture evidence accepted' });
  await page.getByText('Fixture evidence accepted', { exact: true }).waitFor({ timeout: 15000 });
  assert.match(await panel.innerText(), /Ready/);
  const artifacts = join(process.cwd(), '.keynu', 'test-artifacts'); await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: join(artifacts, 'execution-monitor.png'), fullPage: true });
  assert.equal(await panel.evaluate(element => element.scrollWidth > element.clientWidth), false);
  console.log('Execution monitor dashboard: live endpoint, read-only policy, rendered goals and polling updates passed.');
} finally {
  await browser?.close(); await dashboard.close();
  if (previous === undefined) delete process.env.KEYNU_EXECUTION_STATE_DIR; else process.env.KEYNU_EXECUTION_STATE_DIR = previous;
  await rm(root, { recursive: true, force: true });
}
