import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
