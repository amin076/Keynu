import { PersistentJobStore } from '../runtime/PersistentJobStore.js';

export class JobStateService {
  private readonly store = new PersistentJobStore();

  async get(jobId: string) {
    return await this.store.get(jobId);
  }

  async start(jobId: string) {
    return await this.store.set(jobId, 'RUNNING');
  }

  async complete(jobId: string, reportId?: string) {
    return await this.store.set(jobId, 'COMPLETED', reportId);
  }

  async fail(jobId: string, reportId?: string) {
    return await this.store.set(jobId, 'FAILED', reportId);
  }
}
