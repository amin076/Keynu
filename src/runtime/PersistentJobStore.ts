import { mkdir, readFile, writeFile } from "node:fs/promises";
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
};

type JobStoreData = {
  jobs: Record<string, StoredJob>;
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

  async set(
    jobId: string,
    state: StoredJobState,
    reportId?: string,
  ): Promise<void> {
    const data = await this.load();
    data.jobs[jobId] = {
      jobId,
      state,
      reportId,
      updatedAt: new Date().toISOString(),
    };
    await this.save(data);
  }

  private async load(): Promise<JobStoreData> {
    try {
      const text = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(text) as Partial<JobStoreData>;
      return {
        jobs: parsed.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {},
      };
    } catch {
      return { jobs: {} };
    }
  }

  private async save(data: JobStoreData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = this.filePath + ".tmp";
    await writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(tempPath, this.filePath);
  }
}
