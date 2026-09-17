import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ActiveMissionResolver } from '../ActiveMissionResolver.js';
import { BrowserContinuationCoordinator } from '../BrowserContinuationCoordinator.js';
import { ContinuationDeliveryService } from '../ContinuationDeliveryService.js';
import { ContinuationDeliveryStore } from '../ContinuationDeliveryStore.js';
import { ContinuationStore } from '../ContinuationStore.js';
import { MissionRegistry } from '../MissionRegistry.js';
import { MissionStateStore } from '../MissionStateStore.js';
import {
  projectExecutionLockPath,
  withProjectExecutionLease,
} from '../execution/ProjectExecutionLease.js';

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const root = mkdtempSync(join(tmpdir(), 'keynu-project-ownership-'));

try {
  writeJson(join(root, '.keynu', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root,
        activeMissionId: 'ownership-test',
      },
    ],
  });
  writeJson(join(root, '.keynu', 'missions', 'keynu', 'ownership-test.json'), {
    id: 'ownership-test',
    projectId: 'keynu',
    title: 'Ownership Test',
    goal: 'Prove Browser and API execution cannot own one project concurrently.',
    status: 'ACTIVE',
    currentMilestone: 'Verify shared ownership',
    completedMilestones: [],
    nextMilestones: [],
    rules: ['Fail closed on ownership conflicts.'],
    updatedAt: '2026-09-17T00:00:00.000Z',
  });
  writeJson(join(root, '.keynu', 'missions', 'state.json'), {
    version: '1.0',
    activeProjectId: 'keynu',
    activeMissionId: 'ownership-test',
    missions: {
      'ownership-test': {
        missionId: 'ownership-test',
        projectId: 'keynu',
        status: 'ACTIVE',
        currentMilestone: 'Verify shared ownership',
        updatedAt: '2026-09-17T00:00:00.000Z',
      },
    },
    updatedAt: '2026-09-17T00:00:00.000Z',
  });

  const continuationStore = new ContinuationStore({
    rootDir: join(root, 'continuations'),
  });
  const deliveryStore = new ContinuationDeliveryStore({
    rootDir: join(root, 'deliveries'),
  });
  const stateStore = new MissionStateStore(
    join(root, '.keynu', 'missions', 'state.json'),
  );
  const resolver = new ActiveMissionResolver({
    registry: new MissionRegistry(root),
    stateStore,
  });
  const resolution = resolver.resolve();
  assert.equal(resolution.projectRoot, realpathSync(root));
  assert.equal(
    projectExecutionLockPath(root),
    join(realpathSync(root), '.keynu', 'state', 'mission-execution'),
  );

  const coordinator = new BrowserContinuationCoordinator({
    continuationStore,
    deliveryService: new ContinuationDeliveryService(deliveryStore),
    activeMissionResolver: resolver,
    missionStateStore: stateStore,
  });
  let sends = 0;

  await withProjectExecutionLease(root, async () => {
    await assert.rejects(
      coordinator.continueAfterReport(
        {
          missionId: 'ownership-test',
          missionTitle: 'Ownership Test',
          jobId: 'job-browser-conflict-001',
          reportStatus: 'COMPLETED',
        },
        async () => {
          sends += 1;
        },
      ),
      /Store busy/,
    );
  });

  assert.equal(sends, 0, 'Browser continuation must not send while another owner holds the project.');
  assert.equal(
    continuationStore.read('ownership-test'),
    undefined,
    'Ownership conflict must not persist a continuation as if it ran.',
  );

  const delivered = await coordinator.continueAfterReport(
    {
      missionId: 'ownership-test',
      missionTitle: 'Ownership Test',
      jobId: 'job-browser-after-release-001',
      reportStatus: 'COMPLETED',
    },
    async () => {
      sends += 1;
    },
  );

  assert.equal(delivered.deliveryStatus, 'DELIVERED');
  assert.equal(sends, 1, 'Browser continuation should run after ownership is released.');
  assert.equal(continuationStore.read('ownership-test')?.jobId, 'job-browser-after-release-001');

  console.log('PASS shared project execution ownership');
} finally {
  rmSync(root, { recursive: true, force: true });
}
