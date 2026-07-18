import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuntimeGraphIntelligence } from '../RuntimeGraphIntelligence.js';

const root = mkdtempSync(join(tmpdir(), 'keynu-runtime-graph-'));
try {
  const missionDir = join(root, '.keynu', 'missions');
  const graphDir = join(root, '.keynu', 'graph');
  mkdirSync(missionDir, { recursive: true });
  mkdirSync(graphDir, { recursive: true });
  writeFileSync(join(missionDir, 'state.json'), JSON.stringify({
    activeProjectId: 'keynu',
    activeMissionId: 'mission-test',
    runtimeState: 'RUNNING',
    missions: {
      'mission-test': {
        status: 'ACTIVE',
        currentMilestone: 'Runtime graph intelligence',
        lastJobId: 'job-test-001',
      },
    },
  }), 'utf8');
  writeFileSync(join(graphDir, 'snapshot.json'), JSON.stringify({
    version: '1.0',
    generatedAt: '2026-07-14T00:00:00.000Z',
    projectRoot: root,
    nodes: [
      { id: 'mission-test', type: 'mission', status: 'ACTIVE' },
      { id: 'job-test-001', type: 'job', status: 'COMPLETED' },
      { id: 'browser-agent', type: 'component' },
    ],
    edges: [
      { source: 'mission-test', target: 'job-test-001', type: 'EXECUTED' },
      { source: 'job-test-001', target: 'browser-agent', type: 'USED_COMPONENT' },
    ],
  }), 'utf8');

  const snapshot = new RuntimeGraphIntelligence({ rootDir: root }).createSnapshot();
  assert.equal(snapshot.activeProjectId, 'keynu');
  assert.equal(snapshot.activeMissionId, 'mission-test');
  assert.equal(snapshot.missionStatus, 'ACTIVE');
  assert.equal(snapshot.currentMilestone, 'Runtime graph intelligence');
  assert.equal(snapshot.lastJobId, 'job-test-001');
  assert.equal(snapshot.runtimeState, 'RUNNING');
  assert.equal(snapshot.nodeCount, 3);
  assert.equal(snapshot.edgeCount, 2);
  assert.equal(snapshot.nodesByType.mission, 1);
  assert.equal(snapshot.edgesByType.EXECUTED, 1);
  assert.equal(snapshot.activeNodes.length, 1);
  assert.deepEqual(snapshot.warnings, []);

  const missing = new RuntimeGraphIntelligence({ rootDir: join(root, 'missing') }).createSnapshot();
  assert.equal(missing.nodeCount, 0);
  assert.equal(missing.edgeCount, 0);
  assert.equal(missing.warnings.length, 2);
  console.log('RuntimeGraphIntelligence.test passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
