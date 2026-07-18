import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ActiveMissionResolver,
  type ActiveMissionResolution,
} from '../mission/ActiveMissionResolver.js';
import { MissionRegistry } from '../mission/MissionRegistry.js';
import { MissionStateStore } from '../mission/MissionStateStore.js';
import {
  RuntimeGraphRecommendationService,
  type RuntimeGraphRecommendation,
} from './RuntimeGraphRecommendationService.js';

type JsonRecord = Record<string, unknown>;

export type RuntimeGraphNode = {
  id: string;
  type: string;
  label?: string;
  status?: string;
  metadata?: JsonRecord;
};

export type RuntimeGraphEdge = {
  id?: string;
  source: string;
  target: string;
  type: string;
  metadata?: JsonRecord;
};

export type RuntimeGraphMissionResolution = {
  projectId: string | null;
  missionId: string | null;
  action: ActiveMissionResolution['action'];
  stateMismatch: boolean;
  requiresBootstrap: boolean;
  persistedActiveProjectId?: string;
  persistedActiveMissionId?: string;
  diagnostics: string[];
};

export type RuntimeGraphHistoricalMission = {
  missionId: string;
  projectId?: string;
  status?: string;
  currentMilestone?: string;
  lastJobId?: string;
};

export type RuntimeGraphSnapshot = {
  generatedAt: string;
  graphGeneratedAt: string | null;
  graphVersion: string | null;
  graphProjectRoot: string | null;
  graphSnapshotPath: string;
  missionResolution?: RuntimeGraphMissionResolution;
  activeProjectId: string | null;
  activeMissionId: string | null;
  missionStatus: string | null;
  currentMilestone: string | null;
  lastJobId: string | null;
  runtimeState: string | null;
  historicalMissions?: RuntimeGraphHistoricalMission[];
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  activeNodes: RuntimeGraphNode[];
  recentEdges: RuntimeGraphEdge[];
  warnings: string[];
};

export type RuntimeGraphIntelligenceOptions = {
  rootDir?: string;
  missionStatePath?: string;
  graphSnapshotPath?: string;
  activeMissionResolver?: ActiveMissionResolver;
  maxActiveNodes?: number;
  maxRecentEdges?: number;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readJson(file: string): JsonRecord | null {
  if (!existsSync(file)) return null;
  try {
    return record(JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
  } catch {
    return null;
  }
}

function normalizeNode(value: unknown): RuntimeGraphNode | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id) || text(item.nodeId);
  if (!id) return null;
  return {
    id,
    type: text(item.type) || text(item.kind) || 'unknown',
    label: text(item.label) || text(item.name) || text(item.title) || undefined,
    status: text(item.status) || undefined,
    metadata: record(item.metadata) || undefined,
  };
}

function normalizeEdge(value: unknown): RuntimeGraphEdge | null {
  const item = record(value);
  if (!item) return null;
  const source = text(item.source) || text(item.from) || text(item.sourceId);
  const target = text(item.target) || text(item.to) || text(item.targetId);
  if (!source || !target) return null;
  return {
    id: text(item.id) || undefined,
    source,
    target,
    type: text(item.type) || text(item.kind) || text(item.relationship) || 'related',
    metadata: record(item.metadata) || undefined,
  };
}

function counts<T>(items: T[], selector: (item: T) => string) {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

export class RuntimeGraphIntelligence {
  private readonly rootDir: string;
  private readonly missionStatePath: string;
  private readonly graphSnapshotPath: string;
  private readonly activeMissionResolver: ActiveMissionResolver;
  private readonly maxActiveNodes: number;
  private readonly maxRecentEdges: number;

  constructor(options: RuntimeGraphIntelligenceOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.missionStatePath = options.missionStatePath || join(this.rootDir, '.keynu', 'missions', 'state.json');
    this.graphSnapshotPath = options.graphSnapshotPath || join(this.rootDir, '.keynu', 'graph', 'snapshot.json');
    this.activeMissionResolver =
      options.activeMissionResolver ||
      new ActiveMissionResolver({
        registry: new MissionRegistry(this.rootDir),
        stateStore: new MissionStateStore(this.missionStatePath),
      });
    this.maxActiveNodes = options.maxActiveNodes || 30;
    this.maxRecentEdges = options.maxRecentEdges || 50;
  }

  createSnapshot(): RuntimeGraphSnapshot {
    const warnings: string[] = [];
    const missionState = readJson(this.missionStatePath);
    const graphState = readJson(this.graphSnapshotPath);
    const resolution = this.activeMissionResolver.resolve();
    const resolvedBlocked = resolution.action === 'BLOCKED';

    if (!missionState) warnings.push('Mission state is missing or invalid: ' + this.missionStatePath);
    if (!graphState) warnings.push('Graph snapshot is missing or invalid: ' + this.graphSnapshotPath);
    if (resolvedBlocked) warnings.push(...resolution.diagnostics);
    if (resolution.stateMismatch) warnings.push(...resolution.diagnostics);

    const activeProjectId = resolvedBlocked ? null : resolution.projectId;
    const activeMissionId = resolvedBlocked ? null : resolution.missionId;
    const missions = record(missionState?.missions);
    const activeMission = activeMissionId ? record(missions?.[activeMissionId]) : null;
    const historicalMissions = Object.entries(missions ?? {})
      .map(([missionId, value]): RuntimeGraphHistoricalMission | null => {
        const item = record(value);
        if (!item) return null;
        return {
          missionId,
          projectId: text(item.projectId) || undefined,
          status: text(item.status) || undefined,
          currentMilestone: text(item.currentMilestone) || undefined,
          lastJobId: text(item.lastJobId) || undefined,
        };
      })
      .filter((item): item is RuntimeGraphHistoricalMission => item !== null);
    const nodes = Array.isArray(graphState?.nodes) ? graphState.nodes.map(normalizeNode).filter((item): item is RuntimeGraphNode => item !== null) : [];
    const edges = Array.isArray(graphState?.edges) ? graphState.edges.map(normalizeEdge).filter((item): item is RuntimeGraphEdge => item !== null) : [];
    const activeNodes = nodes.filter((node) => {
      if (node.id === activeMissionId || node.metadata?.missionId === activeMissionId) {
        return true;
      }

      if (node.status !== 'ACTIVE' && node.status !== 'RUNNING') {
        return false;
      }

      const nodeMissionId = text(node.metadata?.missionId);
      return !nodeMissionId || nodeMissionId === activeMissionId;
    }).slice(0, this.maxActiveNodes);

    return {
      generatedAt: new Date().toISOString(),
      graphGeneratedAt: text(graphState?.generatedAt),
      graphVersion: text(graphState?.version),
      graphProjectRoot: text(graphState?.projectRoot),
      graphSnapshotPath: this.graphSnapshotPath,
      missionResolution: {
        projectId: resolvedBlocked ? null : resolution.projectId,
        missionId: resolvedBlocked ? null : resolution.missionId,
        action: resolution.action,
        stateMismatch: resolution.stateMismatch,
        requiresBootstrap: resolution.requiresBootstrap,
        persistedActiveProjectId: resolution.persistedActiveProjectId,
        persistedActiveMissionId: resolution.persistedActiveMissionId,
        diagnostics: [...resolution.diagnostics],
      },
      activeProjectId,
      activeMissionId,
      missionStatus: text(activeMission?.status),
      currentMilestone: text(activeMission?.currentMilestone),
      lastJobId: text(activeMission?.lastJobId),
      runtimeState: text(activeMission?.runtimeState) || text(missionState?.runtimeState),
      historicalMissions,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodesByType: counts(nodes, (node) => node.type),
      edgesByType: counts(edges, (edge) => edge.type),
      activeNodes,
      recentEdges: edges.slice(-this.maxRecentEdges),
      warnings,
    };
  }


  recommendNextActions(
    snapshot: RuntimeGraphSnapshot = this.createSnapshot(),
  ): RuntimeGraphRecommendation[] {
    const service = new RuntimeGraphRecommendationService();

    const nodes = [...snapshot.activeNodes];

    if (
      snapshot.activeMissionId &&
      !nodes.some((node) => node.id === snapshot.activeMissionId)
    ) {
      nodes.push({
        id: snapshot.activeMissionId,
        type: 'mission',
        label: snapshot.currentMilestone || snapshot.activeMissionId,
        status: snapshot.missionStatus || undefined,
        metadata: {
          source: 'mission-state',
          projectId: snapshot.activeProjectId,
          currentMilestone: snapshot.currentMilestone,
        }
      });
    }

    return service.recommend({
      activeProjectId: snapshot.activeProjectId,
      activeMissionId: snapshot.activeMissionId,
      nodes,
      edges: snapshot.recentEdges,
    });
  }
}
