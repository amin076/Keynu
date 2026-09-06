import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type StoredJobState =
  | "RECEIVED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "INTERRUPTED";

export type StoredJob = {
  jobId: string;
  state: StoredJobState;
  updatedAt: string;
  reportId?: string;
  reportText?: string;
  reportDeliveredAt?: string;
};

type JobStoreData = {
  jobs: Record<string, StoredJob>;
};

export type JobClaimResult = {
  created: boolean;
  record: StoredJob;
};

export class PersistentJobStore {
  private readonly filePath: string;

  constructor(cwd = process.cwd()) {
    this.filePath = resolve(cwd, ".keynu", "state", "processed-jobs.json");
  }

  async get(jobId: string): Promise<StoredJob | undefined> {
    const data = await this.load();
    return data.jobs[jobId];
  }

  async has(jobId: string): Promise<boolean> {
    return Boolean(await this.get(jobId));
  }

  async claim(jobId: string): Promise<JobClaimResult> {
    const data = await this.load();
    const existing = data.jobs[jobId];

    if (existing) {
      return { created: false, record: existing };
    }

    const record: StoredJob = {
      jobId,
      state: "RECEIVED",
      updatedAt: new Date().toISOString(),
    };
    data.jobs[jobId] = record;
    await this.save(data);
    return { created: true, record };
  }

  async set(
    jobId: string,
    state: StoredJobState,
    reportId?: string,
  ): Promise<StoredJob> {
    const data = await this.load();
    const existing = data.jobs[jobId];
    const record: StoredJob = {
      ...existing,
      jobId,
      state,
      reportId: reportId ?? existing?.reportId,
      updatedAt: new Date().toISOString(),
    };
    data.jobs[jobId] = record;
    await this.save(data);
    return record;
  }

  async recordReport(
    jobId: string,
    state: "COMPLETED" | "FAILED" | "CANCELLED",
    reportText: string,
    reportId?: string,
  ): Promise<StoredJob> {
    if (!reportText.trim()) {
      throw new Error("Persisted job report text must not be empty.");
    }

    const data = await this.load();
    const existing = data.jobs[jobId];
    const record: StoredJob = {
      ...existing,
      jobId,
      state,
      reportId: reportId ?? existing?.reportId,
      reportText,
      reportDeliveredAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    data.jobs[jobId] = record;
    await this.save(data);
    return record;
  }

  async markReportDelivered(jobId: string): Promise<StoredJob> {
    const data = await this.load();
    const existing = data.jobs[jobId];

    if (!existing) {
      throw new Error(`Stored job '${jobId}' was not found.`);
    }
    if (!existing.reportText) {
      throw new Error(`Stored job '${jobId}' has no persisted report.`);
    }

    const record: StoredJob = {
      ...existing,
      reportDeliveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.jobs[jobId] = record;
    await this.save(data);
    return record;
  }

  async markInterrupted(jobId: string): Promise<StoredJob> {
    return this.set(jobId, "INTERRUPTED");
  }

  private async load(): Promise<JobStoreData> {
    try {
      const text = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(text) as Partial<JobStoreData>;
      return {
        jobs: parsed.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {},
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { jobs: {} };
      }
      throw error;
    }
  }

  private async save(data: JobStoreData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = this.filePath + ".tmp";
    await writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }
}
