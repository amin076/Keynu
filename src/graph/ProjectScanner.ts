import { readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { GraphEdge, GraphNode, GraphSnapshot } from "./GraphTypes.js";

export type ProjectScannerOptions = {
  ignoredDirectories?: string[];
  ignoredFiles?: string[];
  maximumFiles?: number;
};

const DEFAULT_IGNORED = [
  ".git",
  ".keynu",
  "dist",
  "node_modules",
  "runtime-data",
  "chrome-profile",
  "coverage",
];

const DEFAULT_IGNORED_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
];

export class ProjectScanner {
  constructor(
    private readonly projectRoot = process.cwd(),
    private readonly options: ProjectScannerOptions = {},
  ) {}

  scan(): GraphSnapshot {
    const root = resolve(this.projectRoot);
    const ignored = new Set([
      ...DEFAULT_IGNORED,
      ...(this.options.ignoredDirectories ?? []),
    ]);
    const ignoredFiles = new Set([
      ...DEFAULT_IGNORED_FILES,
      ...(this.options.ignoredFiles ?? []),
    ]);
    const maximumFiles = this.options.maximumFiles ?? 5000;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let fileCount = 0;

    const projectId = "project:" + root.toLowerCase();
    nodes.push({
      id: projectId,
      label: basename(root),
      kind: "project",
      path: root,
      state: "idle",
    });

    const visit = (directory: string, parentId: string): void => {
      const entries = readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (entry.isDirectory() && ignored.has(entry.name)) continue;
        if (entry.isFile() && ignoredFiles.has(entry.name)) continue;
        if (fileCount >= maximumFiles) return;

        const fullPath = join(directory, entry.name);
        const projectPath = relative(root, fullPath).replaceAll("\\", "/");
        const nodeId = (entry.isDirectory() ? "folder:" : "file:") + projectPath;

        if (entry.isDirectory()) {
          nodes.push({
            id: nodeId,
            label: entry.name,
            kind: "folder",
            path: projectPath,
            parentId,
            state: "idle",
          });
          edges.push({
            id: parentId + "->" + nodeId,
            source: parentId,
            target: nodeId,
            kind: "contains",
            state: "idle",
          });
          visit(fullPath, nodeId);
          continue;
        }

        if (!entry.isFile()) continue;
        fileCount += 1;
        const stats = statSync(fullPath);
        nodes.push({
          id: nodeId,
          label: entry.name,
          kind: "file",
          path: projectPath,
          parentId,
          state: "idle",
          metadata: { bytes: stats.size },
        });
        edges.push({
          id: parentId + "->" + nodeId,
          source: parentId,
          target: nodeId,
          kind: "contains",
          state: "idle",
        });
      }
    };

    visit(root, projectId);

    return {
      version: "1.0",
      projectRoot: root,
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
    };
  }
}
