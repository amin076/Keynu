export const RuntimeEvents = {
  KAP_RECEIVED: 'runtime.kap.received',
  KAP_PARSED: 'runtime.kap.parsed',
  JOB_ACCEPTED: 'runtime.job.accepted',
  JOB_STARTED: 'runtime.job.started',
  JOB_PROGRESS: 'runtime.job.progress',
  JOB_COMPLETED: 'runtime.job.completed',
  JOB_FAILED: 'runtime.job.failed',
  REPORT_CREATED: 'runtime.report.created',
  REPORT_SENT: 'runtime.report.sent',
  DRIVER_STARTED: 'runtime.driver.started',
  DRIVER_COMPLETED: 'runtime.driver.completed',
  DRIVER_FAILED: 'runtime.driver.failed'
} as const;

export type RuntimeEventName = (typeof RuntimeEvents)[keyof typeof RuntimeEvents];
