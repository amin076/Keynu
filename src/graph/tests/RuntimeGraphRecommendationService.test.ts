import { strict as assert } from 'node:assert';
import { RuntimeGraphRecommendationService } from '../RuntimeGraphRecommendationService.js';

const service = new RuntimeGraphRecommendationService();

const recommendations = service.recommend({
  activeProjectId: 'keynu',
  activeMissionId: 'mission-active',
  nodes: [
    {
      id: 'mission-active',
      type: 'mission',
      label: 'Knowledge Graph Engine',
      status: 'ACTIVE',
    },
    {
      id: 'job-failed',
      type: 'job',
      label: 'Failed runtime job',
      status: 'FAILED',
    },
    {
      id: 'dependency-blocked',
      type: 'dependency',
      status: 'BLOCKED',
    },
    {
      id: 'isolated-node',
      type: 'document',
      status: 'READY',
    },
  ],
  edges: [
    {
      source: 'dependency-blocked',
      target: 'job-failed',
      type: 'DEPENDS_ON',
    },
  ],
});

assert.equal(recommendations[0]?.priority, 'CRITICAL');
assert.equal(recommendations[0]?.relatedNodeIds.includes('job-failed'), true);
assert.equal(
  recommendations.some((item) => item.id === 'unblock-dependency-blocked'),
  true,
);
assert.equal(
  recommendations.some((item) => item.id === 'derive-next-action-mission-active'),
  true,
);
assert.equal(
  recommendations.some((item) => item.id === 'connect-isolated-graph-nodes'),
  true,
);

const missingMission = service.recommend({
  activeProjectId: 'keynu',
  activeMissionId: 'mission-missing',
  nodes: [],
  edges: [],
});

assert.equal(
  missingMission.some(
    (item) => item.id === 'restore-missing-mission-mission-missing',
  ),
  true,
);

const noActiveMission = service.recommend({
  activeProjectId: 'keynu',
  activeMissionId: null,
  nodes: [],
  edges: [],
});

assert.equal(
  noActiveMission.some((item) => item.id === 'select-active-mission'),
  true,
);

console.log('PASS RuntimeGraphRecommendationService');
