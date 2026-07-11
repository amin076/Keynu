export type WorkflowStepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface WorkflowStep {
  id: string;
  status: WorkflowStepStatus;
  jobId?: string;
}

export interface WorkflowState {
  workflowId: string;
  goal: string;
  steps: WorkflowStep[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export class WorkflowEngine {
  constructor() {}

  getNextStep(workflow: WorkflowState): WorkflowStep | undefined {
    return workflow.steps.find(
      (step) => step.status === 'PENDING',
    );
  }

  isCompleted(workflow: WorkflowState): boolean {
    return workflow.steps.every(
      (step) => step.status === 'COMPLETED',
    );
  }

  updateStep(
    workflow: WorkflowState,
    stepId: string,
    status: WorkflowStepStatus,
  ): WorkflowState {
    return {
      ...workflow,
      steps: workflow.steps.map((step) =>
        step.id === stepId
          ? { ...step, status }
          : step,
      ),
      status:
        workflow.steps.every(
          (step) =>
            step.id === stepId
              ? status === 'COMPLETED'
              : step.status === 'COMPLETED',
        )
          ? 'COMPLETED'
          : workflow.status,
    };
  }
}
