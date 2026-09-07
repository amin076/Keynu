import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ActiveMissionResolver } from '../ActiveMissionResolver.js';
import { MissionRegistry } from '../MissionRegistry.js';
import { MissionStateStore } from '../MissionStateStore.js';

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function mission(id: string, projectId: string, milestone: string) {
  return {
    id,
    projectId,
    title: id,
    goal: 'Verify persisted active-project routing.',
    status: 'ACTIVE',
    currentMilestone: milestone,
    completedMilestones: [],
    nextMilestones: ['Continue mission'],
    rules: ['Use persisted active project when no explicit projectId is provided.'],
    updatedAt: '2026-09-07T00:00:00.000Z'
  };
}

const root = mkdtempSync(join(tmpdir(), 'keynu-persisted-project-routing-'));

try {
  writeJson(join(root, 'config', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root,
        activeMissionId: 'runtime-readiness-melakat'
      },
      {
        id: 'melakat',
        name: 'Melakat',
        root,
        activeMissionId: 'melakat-development'
      }
    ]
  });

  writeJson(
    join(root, 'config', 'missions', 'keynu', 'runtime-readiness-melakat.json'),
    mission('runtime-readiness-melakat', 'keynu', 'Verify Keynu runtime')
  );

  writeJson(
    join(root, 'config', 'missions', 'melakat', 'melakat-development.json'),
    mission('melakat-development', 'melakat', 'Continue Melakat development')
  );

  const statePath = join(root, '.keynu', 'missions', 'state.json');
  writeJson(statePath, {
    version: '1.0',
    activeProjectId: 'melakat',
    activeMissionId: 'melakat-development',
    missions: {
      'melakat-development': {
        missionId: 'melakat-development',
        projectId: 'melakat',
        status: 'ACTIVE',
        currentMilestone: 'Continue Melakat development',
        updatedAt: '2026-09-07T00:00:00.000Z'
      }
    },
    updatedAt: '2026-09-07T00:00:00.000Z'
  });

  const stateStore = new MissionStateStore(statePath);
  const resolver = new ActiveMissionResolver({
    registry: new MissionRegistry(root),
    stateStore
  });

  const resolved = resolver.resolve();

  assert.equal(resolved.projectId, 'melakat');
  assert.equal(resolved.missionId, 'melakat-development');
  assert.equal(resolved.stateMismatch, false);
  assert.equal(resolved.action, 'NONE');
  assert.deepEqual(resolved.reasons, ['CONFIG_AND_STATE_MATCH']);

  const explicitlyResolved = resolver.resolve({ projectId: 'keynu' });
  assert.equal(explicitlyResolved.projectId, 'keynu');
  assert.equal(explicitlyResolved.missionId, 'runtime-readiness-melakat');
  assert.equal(explicitlyResolved.stateMismatch, true);
  assert.equal(explicitlyResolved.action, 'REQUIRE_BOOTSTRAP');

  console.log('ActiveMissionResolverPersistedProject.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
