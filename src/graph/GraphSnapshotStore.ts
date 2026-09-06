import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GraphSnapshot } from "./GraphTypes.js";

export class GraphSnapshotStore {
  constructor(
    private readonly snapshotPath = join(
      process.cwd(),
      ".keynu",
      "graph",
      "snapshot.json",
    ),
  ) {}

  write(snapshot: GraphSnapshot): GraphSnapshot {
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(
      this.snapshotPath,
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
    return snapshot;
  }

  read(): GraphSnapshot {
    // A clean Keynu checkout has no runtime graph snapshot yet. Query and
    // dashboard services must still be usable before the first scan rather
    // than turning absence of runtime state into HTTP 500 errors.
    if (!existsSync(this.snapshotPath)) {
      return {
        version: "1.0",
        projectRoot: process.cwd(),
        generatedAt: new Date(0).toISOString(),
        nodes: [],
        edges: [],
      };
    }

    const snapshot = JSON.parse(
      readFileSync(this.snapshotPath, "utf8"),
    ) as GraphSnapshot;

    if (
      snapshot.version !== "1.0" ||
      !Array.isArray(snapshot.nodes) ||
      !Array.isArray(snapshot.edges)
    ) {
      throw new Error("Graph snapshot is invalid.");
    }

    return snapshot;
  }
}
