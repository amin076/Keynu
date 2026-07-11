import { SessionStore } from '../session/index.js';

export class SessionService {
  private readonly store = new SessionStore();

  patch(state: any): void {
    this.store.patch(state);
  }

  read(): any {
    return this.store.read();
  }

  setExecuting(jobId: string): void {
    this.store.patch({
      runtimeState: 'executing',
      lastJobId: jobId,
      lastError: undefined,
    });
  }

  setIdle(reportId?: string, status?: string): void {
    this.store.patch({
      runtimeState: 'idle',
      lastReportId: reportId,
      lastReportStatus: status,
    });
  }
}
