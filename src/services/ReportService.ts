import { createKapSuccessReport, createKapErrorReport } from '../kap/KapReport.js';
import { browserEventBus } from '../browser/BrowserEventBus.js';
import { RuntimeEvents } from '../runtime/RuntimeEvents.js';

export class ReportService {
  async success(jobId: string, result: any): Promise<string> {
    return createKapSuccessReport(jobId, result);
  }

  async error(jobId: string, message: string, result?: any): Promise<string> {
    return createKapErrorReport(jobId, message, result);
  }

  async published(jobId: string, reportId: string): Promise<void> {
    await browserEventBus.emit(RuntimeEvents.REPORT_CREATED, {
      jobId,
      reportId,
      occurredAt: new Date().toISOString(),
    });
  }
}
