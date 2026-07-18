import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { RuntimeGraphIntelligence } from '../RuntimeGraphIntelligence.js';
import type { MissionDefinition } from '../../mission/MissionTypes.js';

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function withRoot(test: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'keynu-runtime-graph-'));

  try {
    test(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function mission(id: string): MissionDefinition {
  return {
    id,
    projectId: 'keynu',
    title: id === 'openai-build-week' ? 'OpenAI Build Week' : 'React Dashboard',
    goal: 'Verify runtime graph mission resolution',
    status: 'ACTIVE',
    currentMilestone:
      id === 'openai-build-week'
        ? 'Prepare Build Week submission'
        : 'Build React Mission Control',
    completedMilestones: [],
    nextMilestones: ['Next graph verification step'],
    rules: ['Use isolated tests.'],
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
}

function writeRegistry(root: string, activeMissionId = 'openai-build-week'): void {
  writeJson(join(root, '.keynu', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root,
        activeMissionId,
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
    runtimeState: 'RUNNING',
    missions: {
      [activeMissionId]: {
        missionId: activeMissionId,
        projectId: 'keynu',
        status: 'ACTIVE',
        currentMilestone: mission(activeMissionId).currentMilestone,
        lastJobId: `job-${activeMissionId}`,
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
    },
    updatedAt: '2026-07-18T00:00:00.000Z',
  });
}

function writeMismatchState(root: string): void {
  writeJson(join(root, '.keynu', 'missions', 'state.json'), {
    version: '1.0',
    activeProjectId: 'keynu',
    activeMissionId: 'react-mission-control-dashboard',
    runtimeState: 'RUNNING',
    missions: {
      'react-mission-control-dashboard': {
        missionId: 'react-mission-control-dashboard',
        projectId: 'keynu',
        status: 'ACTIVE',
        currentMilestone: 'Build React Mission Control',
        lastJobId: 'job-dashboard',
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
      'openai-build-week': {
        missionId: 'openai-build-week',
        projectId: 'keynu',
        status: 'READY',
        currentMilestone: 'Prepare Build Week submission',
        lastJobId: 'job-build-week',
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
    },
    updatedAt: '2026-07-18T00:00:00.000Z',
  });
}

function writeGraph(root: string): void {
  writeJson(join(root, '.keynu', 'graph', 'snapshot.json'), {
    version: '1.0',
    generatedAt: '2026-07-14T00:00:00.000Z',
    projectRoot: root,
    nodes: [
      { id: 'openai-build-week', type: 'mission', status: 'ACTIVE' },
      {
        id: 'react-mission-control-dashboard',
        type: 'mission',
        status: 'ACTIVE',
      },
      { id: 'job-build-week', type: 'job', status: 'COMPLETED' },
      { id: 'browser-agent', type: 'component' },
    ],
    edges: [
      { source: 'openai-build-week', target: 'job-build-week', type: 'EXECUTED' },
      {
        source: 'react-mission-control-dashboard',
        target: 'browser-agent',
        type: 'USED_COMPONENT',
      },
    ],
  });
}

withRoot((root) => {
  writeRegistry(root);
  writeState(root, 'openai-build-week');
  writeGraph(root);

  const snapshot = new RuntimeGraphIntelligence({ rootDir: root }).createSnapshot();

  assert.equal(snapshot.activeProjectId, 'keynu');
  assert.equal(snapshot.activeMissionId, 'openai-build-week');
  assert.equal(snapshot.missionStatus, 'ACTIVE');
  assert.equal(snapshot.currentMilestone, 'Prepare Build Week submission');
  assert.equal(snapshot.lastJobId, 'job-openai-build-week');
  assert.equal(snapshot.runtimeState, 'RUNNING');
  assert.equal(snapshot.nodeCount, 4);
  assert.equal(snapshot.edgeCount, 2);
  assert.equal(snapshot.nodesByType.mission, 2);
  assert.equal(snapshot.edgesByType.EXECUTED, 1);
  assert.equal(snapshot.missionResolution?.action, 'NONE');
  assert.equal(snapshot.missionResolution?.stateMismatch, false);
  assert.equal(snapshot.warnings.length, 0);
});

withRoot((root) => {
  writeRegistry(root);
  writeMismatchState(root);
  writeGraph(root);

  const snapshot = new RuntimeGraphIntelligence({ rootDir: root }).createSnapshot();

  assert.equal(snapshot.activeMissionId, 'openai-build-week');
  assert.equal(snapshot.missionStatus, 'READY');
  assert.equal(snapshot.currentMilestone, 'Prepare Build Week submission');
  assert.equal(snapshot.missionResolution?.action, 'REQUIRE_BOOTSTRAP');
  assert.equal(snapshot.missionResolution?.stateMismatch, true);
  assert.equal(
    snapshot.missionResolution?.persistedActiveMissionId,
    'react-mission-control-dashboard',
  );
  assert.match(snapshot.warnings.join('\n'), /differs from persisted active mission/);
  assert.equal(
    snapshot.historicalMissions?.some(
      (item) => item.missionId === 'react-mission-control-dashboard',
    ),
    true,
  );
});

withRoot((root) => {
  writeRegistry(root);
  writeGraph(root);

  const snapshot = new RuntimeGraphIntelligence({ rootDir: root }).createSnapshot();

  assert.equal(snapshot.activeMissionId, 'openai-build-week');
  assert.equal(snapshot.missionStatus, null);
  assert.equal(snapshot.missionResolution?.action, 'RECONCILE_STATE');
  assert.match(snapshot.warnings.join('\n'), /Mission state is missing or invalid/);
});

withRoot((root) => {
  writeJson(join(root, '.keynu', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root,
        activeMissionId: 'missing-mission',
      },
    ],
  });
  writeGraph(root);

  const snapshot = new RuntimeGraphIntelligence({ rootDir: root }).createSnapshot();

  assert.equal(snapshot.activeMissionId, null);
  assert.equal(snapshot.missionResolution?.action, 'BLOCKED');
  assert.match(snapshot.warnings.join('\n'), /Mission definition not found/);
});

console.log('RuntimeGraphIntelligence.test passed');
