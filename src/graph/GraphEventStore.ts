import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GraphEvent, GraphEventType } from "./GraphTypes.js";

export type AppendGraphEventInput = Omit<GraphEvent, "id" | "time"> & {
  id?: string;
  time?: string;
};

export type GraphEventStoreOptions = {
  maximumBytes?: number;
  retainedEvents?: number;
};

export type GraphEventQuery = {
  jobId?: string;
  missionId?: string;
  workflowId?: string;
  taskId?: string;
  type?: GraphEventType;
  nodeId?: string;
  edgeId?: string;
  offset?: number;
  limit?: number;
};

function normalizeInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(0, Math.floor(value as number)));
}

export class GraphEventStore {
  private readonly maximumBytes: number;
  private readonly retainedEvents: number;

  constructor(
    private readonly eventPath = join(process.cwd(), ".keynu", "graph", "events.ndjson"),
    options: GraphEventStoreOptions = {},
  ) {
    this.maximumBytes = normalizeInteger(options.maximumBytes, 5 * 1024 * 1024, Number.MAX_SAFE_INTEGER);
    this.retainedEvents = normalizeInteger(options.retainedEvents, 5000, Number.MAX_SAFE_INTEGER);
  }

  append(input: AppendGraphEventInput): GraphEvent {
    const event: GraphEvent = {
      ...input,
      id: input.id ?? `graph-event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      time: input.time ?? new Date().toISOString(),
    };

    mkdirSync(dirname(this.eventPath), { recursive: true });
    const serialized = JSON.stringify(event) + "\n";
    this.rotateIfNeeded(Buffer.byteLength(serialized, "utf8"));
    appendFileSync(this.eventPath, serialized, "utf8");
    return event;
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (!existsSync(this.eventPath)) return;
    if (statSync(this.eventPath).size + incomingBytes <= this.maximumBytes) return;

    const diagnostics = this.readAllWithDiagnostics();
    const retained = diagnostics.events
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(-this.retainedEvents);
    const rotatedContent = retained.length > 0
      ? retained.map((event) => JSON.stringify(event)).join("\n") + "\n"
      : "";
    const temporaryPath = this.eventPath + ".rotation.tmp";
    const backupPath = this.eventPath + ".rotation.bak";

    writeFileSync(temporaryPath, rotatedContent, "utf8");
    rmSync(backupPath, { force: true });

    try {
      renameSync(this.eventPath, backupPath);
      renameSync(temporaryPath, this.eventPath);
      rmSync(backupPath, { force: true });
    } catch (error) {
      if (!existsSync(this.eventPath) && existsSync(backupPath)) {
        renameSync(backupPath, this.eventPath);
      }
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  readAll(): GraphEvent[] {
    return this.readAllWithDiagnostics().events;
  }

  readAllWithDiagnostics(): {
    events: GraphEvent[];
    malformedLineCount: number;
    malformedLines: number[];
  } {
    if (!existsSync(this.eventPath)) {
      return { events: [], malformedLineCount: 0, malformedLines: [] };
    }

    const events: GraphEvent[] = [];
    const malformedLines: number[] = [];
    const lines = readFileSync(this.eventPath, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        events.push(JSON.parse(line) as GraphEvent);
      } catch {
        malformedLines.push(index + 1);
      }
    });

    return {
      events,
      malformedLineCount: malformedLines.length,
      malformedLines,
    };
  }

  query(options: GraphEventQuery = {}) {
    const offset = normalizeInteger(options.offset, 0, Number.MAX_SAFE_INTEGER);
    const limit = normalizeInteger(options.limit, 100, 500);

    const items = this.readAll()
      .filter((event) =>
        (!options.jobId || event.jobId === options.jobId) &&
        (!options.missionId || event.missionId === options.missionId) &&
        (!options.workflowId || event.workflowId === options.workflowId) &&
        (!options.taskId || event.taskId === options.taskId) &&
        (!options.type || event.type === options.type) &&
        (!options.nodeId || event.nodeId === options.nodeId) &&
        (!options.edgeId || event.edgeId === options.edgeId),
      )
      .sort((a, b) => b.time.localeCompare(a.time));

    return {
      total: items.length,
      offset,
      limit,
      items: items.slice(offset, offset + limit),
    };
  }

  getSummary() {
    const diagnostics = this.readAllWithDiagnostics();
    const events = diagnostics.events;
    const eventTypes = events.reduce<Record<string, number>>((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {});

    return {
      available: existsSync(this.eventPath),
      eventCount: events.length,
      bytes: existsSync(this.eventPath) ? statSync(this.eventPath).size : 0,
      eventTypes,
      latestEventAt: events.reduce<string | undefined>((latest, event) =>
        !latest || event.time > latest ? event.time : latest,
        undefined,
      ),
      malformedLineCount: diagnostics.malformedLineCount,
      malformedLines: diagnostics.malformedLines,
      maximumBytes: this.maximumBytes,
      retainedEvents: this.retainedEvents,
    };
  }
}
