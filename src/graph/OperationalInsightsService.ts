import { EffectiveGraphQueryService } from "./EffectiveGraphQueryService.js";
import type { GraphEdge, GraphNode } from "./GraphTypes.js";

export type OperationalInsightSeverity = "info" | "warning" | "critical";

export type OperationalInsightCategory =
  | "unresolved-failure"
  | "recovered-failure"
  | "historical-failure"
  | "active-operation"
  | "stale-operation"
  | "frequently-touched-file"
  | "high-impact-file"
  | "unmatched-runtime-path";

export type OperationalInsight = {
  id: string;
  category: OperationalInsightCategory;
  severity: OperationalInsightSeverity;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
};

type FileActivityScore = {
  node: GraphNode;
  reads: number;
  writes: number;
  total: number;
};

type FileImpactScore = {
  node: GraphNode;
  impactedNodeCount: number;
  impactEdgeCount: number;
};

function latestRuntimeTime(node: GraphNode): string {
  return String(node.metadata?.latestRuntimeEventAt ?? "");
}

function normalizeJobFamily(value: string): string {
  return value
    .replace(/^job:/, "")
    .replace(/-(fixed|fix|recover|recovered|retry|verification|verify)(?:-[a-z0-9]+)*-\d+[a-z]?$/i, "")
    .replace(/-\d+[a-z]?$/i, "")
    .replace(/-(fixed|fix|recover|recovered|retry|verification|verify)$/i, "");
}

function workflowId(node: GraphNode): string {
  return String(node.metadata?.workflowId ?? "");
}

function isNewer(candidate: GraphNode, reference: GraphNode): boolean {
  return latestRuntimeTime(candidate) > latestRuntimeTime(reference);
}

function commandErrorText(node: GraphNode): string {
  return String(node.metadata?.error ?? "").toLowerCase();
}

function failureHasCurrentSuccessfulEvidence(
  failedJob: GraphNode,
  failedCommands: GraphNode[],
  successfulJobs: GraphNode[],
): boolean {
  const failedId = failedJob.id.replace(/^job:/, "");
  const errors = failedCommands
    .filter((command) => String(command.metadata?.jobId ?? "") === failedId)
    .map(commandErrorText)
    .join("\n");

  const currentCapabilityEvidence = [
    { pattern: /effectivegraphqueryservice|neighbor|impact/, family: /graph|effective|neighbor|impact/ },
    { pattern: /interactivegraphvisualization|graph intelligence api|dashboard api|dashboard.*test|test harness|http 404/, family: /graph|dashboard|api|http|insight/ },
    { pattern: /operationalinsightsservice/, family: /operational|insight/ },
  ];

  return currentCapabilityEvidence.some((rule) =>
    rule.pattern.test(errors) &&
    successfulJobs.some((success) =>
      isNewer(success, failedJob) &&
      rule.family.test(success.label.toLowerCase()),
    ),
  );
}

export class OperationalInsightsService {
  constructor(
    private readonly graph = new EffectiveGraphQueryService(),
  ) {}

  getSummary() {
    const projection = this.graph.getProjection();
    const nodes = projection.snapshot.nodes;
    const edges = projection.snapshot.edges;

    const jobs = nodes.filter((node) => node.kind === "job");
    const commands = nodes.filter((node) => node.kind === "command");
    const files = nodes.filter((node) => node.kind === "file");

    const failedJobs = jobs
      .filter((node) => node.state === "failed")
      .sort((a, b) => latestRuntimeTime(b).localeCompare(latestRuntimeTime(a)));

    const successfulJobs = jobs
      .filter((node) => node.state === "success")
      .sort((a, b) => latestRuntimeTime(b).localeCompare(latestRuntimeTime(a)));

    const recoveredFailedJobs = failedJobs.filter((failed) => {
      const family = normalizeJobFamily(failed.label);
      const workflow = workflowId(failed);
      return (
        successfulJobs.some((success) =>
          isNewer(success, failed) &&
          (
            normalizeJobFamily(success.label) === family ||
            (workflow && workflowId(success) === workflow)
          )
        ) ||
        failureHasCurrentSuccessfulEvidence(
          failed,
          commands.filter((node) => node.state === "failed"),
          successfulJobs,
        )
      );
    });

    const unresolvedFailedJobs = failedJobs.filter(
      (node) => !recoveredFailedJobs.includes(node),
    );

    const now = Date.now();
    const activeJobs = jobs
      .filter((node) => node.state === "active" || node.state === "queued")
      .sort((a, b) => latestRuntimeTime(b).localeCompare(latestRuntimeTime(a)));

    const staleActiveJobs = activeJobs.filter((node) => {
      const timestamp = Date.parse(latestRuntimeTime(node));
      return Number.isFinite(timestamp) && now - timestamp > 5 * 60 * 1000;
    });

    const currentActiveJobs = activeJobs.filter(
      (node) => !staleActiveJobs.includes(node),
    );

    const failedCommands = commands
      .filter((node) => node.state === "failed")
      .sort((a, b) => latestRuntimeTime(b).localeCompare(latestRuntimeTime(a)));

    const frequentlyTouchedFiles = this.rankFileActivity(edges, files);
    const highImpactFiles = this.rankHighImpactFiles(files);
    const insights: OperationalInsight[] = [];

    for (const node of unresolvedFailedJobs.slice(0, 10)) {
      insights.push({
        id: "unresolved-failure:" + node.id,
        category: "unresolved-failure",
        severity: "critical",
        title: "Unresolved failed job: " + node.label,
        summary: "No newer successful job in the same workflow or recovery family was found.",
        evidence: {
          nodeId: node.id,
          latestRuntimeEventId: node.metadata?.latestRuntimeEventId,
          latestRuntimeEventAt: node.metadata?.latestRuntimeEventAt,
          workflowId: node.metadata?.workflowId,
          phase: node.metadata?.phase,
        },
        recommendedAction:
          "Inspect the associated failed commands and determine whether the failure was superseded, repaired, or still requires action.",
      });
    }

    for (const node of staleActiveJobs.slice(0, 10)) {
      insights.push({
        id: "stale-operation:" + node.id,
        category: "stale-operation",
        severity: "warning",
        title: "Possibly stale runtime job: " + node.label,
        summary: "This job remains active or queued beyond the configured freshness window.",
        evidence: {
          nodeId: node.id,
          state: node.state,
          latestRuntimeEventId: node.metadata?.latestRuntimeEventId,
          latestRuntimeEventAt: node.metadata?.latestRuntimeEventAt,
        },
        recommendedAction:
          "Check the runtime process and reconcile the missing terminal event if execution has stopped.",
      });
    }

    for (const item of frequentlyTouchedFiles.slice(0, 10)) {
      insights.push({
        id: "frequently-touched-file:" + item.node.id,
        category: "frequently-touched-file",
        severity: item.writes >= 3 ? "warning" : "info",
        title: "Frequently touched file: " + (item.node.path ?? item.node.label),
        summary:
          "Observed " + item.reads + " read relationship(s) and " + item.writes + " write relationship(s).",
        evidence: {
          nodeId: item.node.id,
          path: item.node.path,
          reads: item.reads,
          writes: item.writes,
          total: item.total,
        },
      });
    }

    for (const item of highImpactFiles.slice(0, 10)) {
      insights.push({
        id: "high-impact-file:" + item.node.id,
        category: "high-impact-file",
        severity: item.impactedNodeCount >= 10 ? "warning" : "info",
        title: "High-impact file: " + (item.node.path ?? item.node.label),
        summary:
          "Changes to this file may affect " + item.impactedNodeCount + " dependent graph node(s).",
        evidence: {
          nodeId: item.node.id,
          path: item.node.path,
          impactedNodeCount: item.impactedNodeCount,
          impactEdgeCount: item.impactEdgeCount,
        },
        recommendedAction:
          "Run focused dependency and regression checks before modifying this file.",
      });
    }

    if (projection.summary.unmatchedRepositoryEvents > 0) {
      insights.push({
        id: "unmatched-runtime-paths",
        category: "unmatched-runtime-path",
        severity: "warning",
        title: "Unmatched repository runtime paths",
        summary:
          String(projection.summary.unmatchedRepositoryEvents) +
          " repository runtime event(s) could not be matched to snapshot nodes.",
        evidence: {
          unmatchedRepositoryEvents: projection.summary.unmatchedRepositoryEvents,
          repositoryPathEvents: projection.summary.repositoryPathEvents,
        },
        recommendedAction:
          "Refresh the repository snapshot or review path normalization and exclusion rules.",
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        jobs: jobs.length,
        commands: commands.length,
        files: files.length,
        failedJobs: failedJobs.length,
        unresolvedFailedJobs: unresolvedFailedJobs.length,
        recoveredFailedJobs: recoveredFailedJobs.length,
        activeJobs: currentActiveJobs.length,
        staleActiveJobs: staleActiveJobs.length,
        failedCommands: failedCommands.length,
        unmatchedRuntimePaths: projection.summary.unmatchedRepositoryEvents,
      },
      unresolvedFailedJobs: unresolvedFailedJobs.slice(0, 20),
      recoveredFailedJobs: recoveredFailedJobs.slice(0, 20),
      activeJobs: currentActiveJobs.slice(0, 20),
      staleActiveJobs: staleActiveJobs.slice(0, 20),
      failedCommands: failedCommands.slice(0, 20),
      frequentlyTouchedFiles: frequentlyTouchedFiles.slice(0, 20),
      highImpactFiles: highImpactFiles.slice(0, 20),
      insights,
    };
  }

  private rankFileActivity(
    edges: GraphEdge[],
    files: GraphNode[],
  ): FileActivityScore[] {
    const filesById = new Map(files.map((node) => [node.id, node]));
    const scores = new Map<string, { reads: number; writes: number }>();

    for (const edge of edges) {
      if (edge.kind !== "reads" && edge.kind !== "writes") continue;
      if (!filesById.has(edge.target)) continue;

      const score = scores.get(edge.target) ?? { reads: 0, writes: 0 };
      if (edge.kind === "reads") score.reads += 1;
      if (edge.kind === "writes") score.writes += 1;
      scores.set(edge.target, score);
    }

    return [...scores.entries()]
      .map(([nodeId, score]) => ({
        node: filesById.get(nodeId)!,
        reads: score.reads,
        writes: score.writes,
        total: score.reads + score.writes,
      }))
      .sort(
        (a, b) =>
          b.total - a.total ||
          b.writes - a.writes ||
          String(a.node.path ?? a.node.label).localeCompare(
            String(b.node.path ?? b.node.label),
          ),
      );
  }

  private rankHighImpactFiles(files: GraphNode[]): FileImpactScore[] {
    return files
      .map((node) => {
        const impact = this.graph.queryImpact(node.id, 4);
        return {
          node,
          impactedNodeCount: impact.impactedNodes.length,
          impactEdgeCount: impact.impactEdges.length,
        };
      })
      .filter((item) => item.impactedNodeCount > 0)
      .sort(
        (a, b) =>
          b.impactedNodeCount - a.impactedNodeCount ||
          b.impactEdgeCount - a.impactEdgeCount ||
          String(a.node.path ?? a.node.label).localeCompare(
            String(b.node.path ?? b.node.label),
          ),
      );
  }
}
