import { promises as fs } from 'fs';

export class WorkflowStore {
  constructor(
    private readonly filePath = '.keynu/workflows.json',
  ) {}

  async get(workflowId: string): Promise<any | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const workflows = JSON.parse(data);
      return workflows[workflowId] ?? null;
    } catch {
      return null;
    }
  }

  async save(workflowId: string, workflow: any): Promise<void> {
    let workflows: Record<string, any> = {};

    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      workflows = JSON.parse(data);
    } catch {
      workflows = {};
    }

    workflows[workflowId] = workflow;
    await fs.writeFile(
      this.filePath,
      JSON.stringify(workflows, null, 2),
      'utf8',
    );
  }
}
