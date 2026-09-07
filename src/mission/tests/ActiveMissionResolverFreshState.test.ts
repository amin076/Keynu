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

const root = mkdtempSync(join(tmpdir(), 'keynu-fresh-melakat-routing-'));

try {
  writeJson(join(root, 'config', 'missions', 'projects.json'), {
    version: '1.0',
    projects: [
      {
        id: 'keynu',
        name: 'Keynu',
        root
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
    join(root, 'config', 'missions', 'melakat', 'melakat-development.json'),
    {
      id: 'melakat-development',
      projectId: 'melakat',
      title: 'Melakat Autonomous Development and Research',
      goal: 'Continue Melakat development.',
      status: 'ACTIVE',
      currentMilestone: 'Continue verified Melakat development',
      completedMilestones: [],
      nextMilestones: ['Continue development'],
      rules: ['Melakat is the active project mission.'],
      updatedAt: '2026-09-07T00:00:00.000Z'
    }
  );

  const statePath = join(root, '.keynu', 'missions', 'state.json');
  const stateStore = new MissionStateStore(statePath);
  const resolver = new ActiveMissionResolver({
    registry: new MissionRegistry(root),
    stateStore
  });

  const initial = resolver.resolve();
  assert.equal(initial.projectId, 'melakat');
  assert.equal(initial.missionId, 'melakat-development');
  assert.equal(initial.action, 'RECONCILE_STATE');
  assert.equal(initial.requiresBootstrap, true);
  assert.deepEqual(initial.reasons, ['PERSISTED_STATE_MISSING']);

  const reconciled = resolver.reconcile();
  assert.equal(reconciled.stateChanged, true);

  const finalResolution = resolver.resolve();
  assert.equal(finalResolution.projectId, 'melakat');
  assert.equal(finalResolution.missionId, 'melakat-development');
  assert.equal(finalResolution.action, 'NONE');
  assert.equal(finalResolution.stateMismatch, false);
  assert.deepEqual(finalResolution.reasons, ['CONFIG_AND_STATE_MATCH']);

  const persisted = stateStore.read();
  assert.equal(persisted.activeProjectId, 'melakat');
  assert.equal(persisted.activeMissionId, 'melakat-development');

  console.log('ActiveMissionResolverFreshState.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
