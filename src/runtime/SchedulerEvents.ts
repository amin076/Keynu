export const SchedulerEvents = {
  JOB_QUEUED: 'scheduler.job.queued',
  JOB_READY: 'scheduler.job.ready',
  JOB_DISPATCHED: 'scheduler.job.dispatched',
  JOB_WAITING: 'scheduler.job.waiting',
  JOB_RESUMED: 'scheduler.job.resumed',
  JOB_RETRY: 'scheduler.job.retry',
  JOB_TIMEOUT: 'scheduler.job.timeout',
  JOB_CANCELLED: 'scheduler.job.cancelled',
  JOB_FINISHED: 'scheduler.job.finished',
  QUEUE_EMPTY: 'scheduler.queue.empty',
  QUEUE_CHANGED: 'scheduler.queue.changed'
} as const;

export type SchedulerEventName = (typeof SchedulerEvents)[keyof typeof SchedulerEvents];
