export type RuntimeGraphRecommendationNode = {
  id: string;
  type: string;
  label?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type RuntimeGraphRecommendationEdge = {
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, unknown>;
};

export type RuntimeGraphRecommendationInput = {
  activeProjectId?: string | null;
  activeMissionId?: string | null;
  nodes: RuntimeGraphRecommendationNode[];
  edges: RuntimeGraphRecommendationEdge[];
};

export type RuntimeGraphRecommendation = {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category:
    | 'RECOVERY'
    | 'MISSION'
    | 'DEPENDENCY'
    | 'GRAPH_QUALITY'
    | 'CONTINUATION';
  title: string;
  reason: string;
  nextAction: string;
  relatedNodeIds: string[];
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function recommendationId(parts: string[]): string {
  return parts
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .join('-')
    .replace(/^-+|-+$/g, '');
}

function hasOutgoingEdge(
  nodeId: string,
  edges: RuntimeGraphRecommendationEdge[],
  acceptedTypes: string[],
): boolean {
  const accepted = new Set(acceptedTypes.map(normalize));
  return edges.some(
    (edge) =>
      edge.source === nodeId && accepted.has(normalize(edge.type)),
  );
}

export class RuntimeGraphRecommendationService {
  recommend(
    input: RuntimeGraphRecommendationInput,
  ): RuntimeGraphRecommendation[] {
    const recommendations: RuntimeGraphRecommendation[] = [];
    const nodeById = new Map(input.nodes.map((node) => [node.id, node]));

    for (const node of input.nodes) {
      const status = normalize(node.status);

      if (status === 'FAILED' || status === 'ERROR') {
        recommendations.push({
          id: recommendationId(['recover', node.id]),
          priority: 'CRITICAL',
          category: 'RECOVERY',
          title: `Recover ${node.label || node.id}`,
          reason: `Graph node ${node.id} is in ${status} state.`,
          nextAction:
            'Inspect the latest failure evidence, repair the smallest verified cause, and rerun the failed operation.',
          relatedNodeIds: [node.id],
        });
      } else if (status === 'BLOCKED') {
        recommendations.push({
          id: recommendationId(['unblock', node.id]),
          priority: 'HIGH',
          category: 'DEPENDENCY',
          title: `Unblock ${node.label || node.id}`,
          reason: `Graph node ${node.id} is blocked.`,
          nextAction:
            'Inspect incoming dependency edges and resolve the nearest unmet prerequisite.',
          relatedNodeIds: [node.id],
        });
      }
    }

    if (!input.activeMissionId) {
      recommendations.push({
        id: 'select-active-mission',
        priority: 'HIGH',
        category: 'MISSION',
        title: 'Select an active mission',
        reason: 'The runtime graph has no active mission identifier.',
        nextAction:
          'Select or restore the mission that owns the current verified work before issuing another autonomous job.',
        relatedNodeIds: [],
      });
    } else {
      const activeMission = nodeById.get(input.activeMissionId);

      if (!activeMission) {
        recommendations.push({
          id: recommendationId(['restore-missing-mission', input.activeMissionId]),
          priority: 'CRITICAL',
          category: 'MISSION',
          title: 'Restore the active mission node',
          reason: `Active mission ${input.activeMissionId} is absent from the effective graph.`,
          nextAction:
            'Rebuild the repository graph snapshot and restore the active mission state before continuing.',
          relatedNodeIds: [input.activeMissionId],
        });
      } else if (
        !hasOutgoingEdge(activeMission.id, input.edges, [
          'NEXT',
          'NEXT_ACTION',
          'REQUIRES',
          'DEPENDS_ON',
          'CONTINUES_WITH',
        ])
      ) {
        recommendations.push({
          id: recommendationId(['derive-next-action', activeMission.id]),
          priority: 'MEDIUM',
          category: 'CONTINUATION',
          title: 'Derive the next mission action',
          reason:
            'The active mission has no explicit outgoing next-action or dependency edge.',
          nextAction:
            'Use the current milestone, unresolved failures, and graph neighbors to create one small verifiable next job.',
          relatedNodeIds: [activeMission.id],
        });
      }
    }

    const isolatedNodes = input.nodes.filter((node) =>
      input.edges.every(
        (edge) => edge.source !== node.id && edge.target !== node.id,
      ),
    );

    if (isolatedNodes.length > 0) {
      recommendations.push({
        id: 'connect-isolated-graph-nodes',
        priority: 'LOW',
        category: 'GRAPH_QUALITY',
        title: 'Connect isolated graph nodes',
        reason: `${isolatedNodes.length} graph node(s) have no relationships.`,
        nextAction:
          'Inspect isolated nodes and add verified ownership, dependency, capability, or mission relationships where evidence exists.',
        relatedNodeIds: isolatedNodes.map((node) => node.id),
      });
    }

    const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
    return recommendations.sort(
      (left, right) =>
        rank[left.priority] - rank[right.priority] ||
        left.id.localeCompare(right.id),
    );
  }
}
