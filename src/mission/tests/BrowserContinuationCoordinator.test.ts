import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ActiveMissionResolver } from '../ActiveMissionResolver.js';
import { BrowserContinuationCoordinator } from '../BrowserContinuationCoordinator.js';
import { ContinuationDeliveryService } from '../ContinuationDeliveryService.js';
import { ContinuationDeliveryStore } from '../ContinuationDeliveryStore.js';
import { ContinuationStore } from '../ContinuationStore.js';
import { MissionRegistry } from '../MissionRegistry.js';
import { MissionStateStore } from '../MissionStateStore.js';
import type { ContinuationContract } from '../ContinuationTypes.js';
import type { MissionDefinition } from '../MissionTypes.js';

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function mission(id: string): MissionDefinition {
  return {
    id,
    projectId: 'keynu',
    title: id === 'openai-build-week' ? 'OpenAI Build Week' : 'React Dashboard',
    goal: 'Verify continuation mission resolution',
    status: 'ACTIVE',
    currentMilestone:
      id === 'openai-build-week'
        ? 'Prepare Build Week submission'
        : 'Build React Mission Control',
    completedMilestones: [],
    nextMilestones: ['Next continuation verification step'],
    rules: ['Use isolated tests.'],
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
}

function writeRegistry(root: string): void {
  writeJson(join(root, '.keynu', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root,
        activeMissionId: 'openai-build-week',
      },
    ],
  });
  writeJson(
    join(root, '.keynu', 'missions', 'keynu', 'openai-build-week.json'),
    mission('openai-build-week'),
  );
  writeJson(
    join(
      root,
      '.keynu',
      'missions',
      'keynu',
      'react-mission-control-dashboard.json',
    ),
    mission('react-mission-control-dashboard'),
  );
}

function writeState(root: string, activeMissionId: string): void {
  writeJson(join(root, '.keynu', 'missions', 'state.json'), {
    version: '1.0',
    activeProjectId: 'keynu',
    activeMissionId,
    missions: {
      'openai-build-week': {
        missionId: 'openai-build-week',
        projectId: 'keynu',
        status: 'ACTIVE',
        currentMilestone: 'Prepare Build Week submission',
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
      'react-mission-control-dashboard': {
        missionId: 'react-mission-control-dashboard',
        projectId: 'keynu',
        status: 'ACTIVE',
        currentMilestone: 'Build React Mission Control',
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
    },
    updatedAt: '2026-07-18T00:00:00.000Z',
  });
}

function createCoordinator(root: string): {
  coordinator: BrowserContinuationCoordinator;
  continuationStore: ContinuationStore;
} {
  const continuationStore = new ContinuationStore({
    rootDir: join(root, 'continuations'),
  });
  const deliveryStore = new ContinuationDeliveryStore({
    rootDir: join(root, 'deliveries'),
  });
  const stateStore = new MissionStateStore(
    join(root, '.keynu', 'missions', 'state.json'),
  );

  return {
    continuationStore,
    coordinator: new BrowserContinuationCoordinator({
      continuationStore,
      deliveryService: new ContinuationDeliveryService(deliveryStore),
      activeMissionResolver: new ActiveMissionResolver({
        registry: new MissionRegistry(root),
        stateStore,
      }),
      missionStateStore: stateStore,
    }),
  };
}

const staleContinuation: ContinuationContract = {
  decision: 'WAITING_AI',
  reason: 'Stale Dashboard continuation should remain historical.',
  nextAction: 'continue_stale_dashboard_work',
  owner: 'ai',
  missionComplete: false,
  retryable: false,
};

const root = mkdtempSync(join(tmpdir(), 'keynu-browser-continuation-'));

try {
  writeRegistry(root);
  writeState(root, 'react-mission-control-dashboard');

  const { coordinator, continuationStore } = createCoordinator(root);
  continuationStore.record(
    'react-mission-control-dashboard',
    'WAITING_AI',
    staleContinuation,
    {
      jobId: 'job-dashboard-stale',
      autonomousStepCount: 7,
      consecutiveFailureCount: 0,
    },
  );

  const messages: string[] = [];
  const completed = await coordinator.continueAfterReport(
    {
      missionId: 'openai-build-week',
      missionTitle: 'OpenAI Build Week',
      jobId: 'job-build-week-completed-001',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 3,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      messages.push(message);
    },
  );

  assert.equal(completed.decision, 'WAITING_AI');
  assert.equal(completed.deliveryStatus, 'DELIVERED');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /KEYNU_CONTINUATION_REQUEST/);
  assert.match(messages[0], /Mission ID: openai-build-week/);
  assert.match(messages[0], /Autonomous Step: 4\/12/);

  const storedActive = continuationStore.read('openai-build-week');
  assert.ok(storedActive);
  assert.equal(storedActive.missionState, 'WAITING_AI');
  assert.equal(storedActive.consecutiveFailureCount, 0);

  const duplicate = await coordinator.continueAfterReport(
    {
      missionId: 'openai-build-week',
      missionTitle: 'OpenAI Build Week',
      jobId: 'job-build-week-completed-001',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 3,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      messages.push(message);
    },
  );

  assert.equal(duplicate.deliveryStatus, 'SKIPPED_DUPLICATE');
  assert.equal(messages.length, 1);

  const staleMessages: string[] = [];
  const stale = await coordinator.continueAfterReport(
    {
      missionId: 'react-mission-control-dashboard',
      missionTitle: 'React Dashboard',
      jobId: 'job-dashboard-completed-001',
      reportStatus: 'COMPLETED',
      autonomousStepCount: 0,
      maxAutonomousSteps: 12,
    },
    async (message) => {
      staleMessages.push(message);
    },
  );

  assert.equal(stale.deliveryStatus, 'SKIPPED_POLICY');
  assert.match(stale.reason, /SKIPPED_NON_ACTIVE_MISSION/);
  assert.equal(staleMessages.length, 0);

  const storedStale = continuationStore.read('react-mission-control-dashboard');
  assert.ok(storedStale);
  assert.equal(storedStale.jobId, 'job-dashboard-stale');
  assert.equal(storedStale.continuation.nextAction, 'continue_stale_dashboard_work');

  const failureMessages: string[] = [];
  const failed = await coordinator.continueAfterReport(
    {
      missionId: 'openai-build-week',
      jobId: 'job-build-week-failed-001',
      reportStatus: 'FAILED',
      autonomousStepCount: 1,
      consecutiveFailureCount: 2,
    },
    async (message) => {
      failureMessages.push(message);
    },
  );

  assert.equal(failed.deliveryStatus, 'DELIVERED');
  assert.equal(failureMessages.length, 1);
  assert.match(failureMessages[0], /recovery decision/i);

  const storedFailed = continuationStore.read('openai-build-week');
  assert.ok(storedFailed);
  assert.equal(storedFailed.consecutiveFailureCount, 3);

  assert.equal(new MissionStateStore(
    join(root, '.keynu', 'missions', 'state.json'),
  ).read().activeMissionId, 'react-mission-control-dashboard');

  console.log('BrowserContinuationCoordinator.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
