import { ExecutionGuard } from '../runtime/ExecutionGuard.js';

export type ExecutionHandledResult = {
  status: 'COMPLETED' | 'FAILED';
  error?: string;
  result?: any;
};

export class ExecutionResultHandler {
  handle(result: any): ExecutionHandledResult {
    const validation = ExecutionGuard.validateExecution(result);

    if (!validation.ok) {
      return {
        status: 'FAILED',
        error: validation.error,
        result,
      };
    }

    return {
      status: 'COMPLETED',
      result,
    };
  }
}
