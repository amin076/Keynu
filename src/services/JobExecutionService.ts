import { routeKapJob } from '../runtime/kap-job-router.js';

export class JobExecutionService {
  async execute(kap: any) {
    if (kap?.payload?.target) {
      return await routeKapJob(kap);
    }

    throw new Error('Unsupported KAP job. Runtime execution has not yet been extracted into JobExecutionService.');
  }
}
