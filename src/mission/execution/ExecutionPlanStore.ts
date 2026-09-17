import { readFile, readdir, mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, withFileLock } from '../../runtime/storage/FileTransaction.js';
import { ExecutionPlan, type ExecutionDatabase, type Evidence, type StepState } from './ExecutionPlan.js';

export class ExecutionPlanStore {
  readonly file: string;
  readonly directory: string;
  constructor(directory: string) {
    this.directory = resolve(directory); this.file = join(this.directory, 'plans.json');
  }
  async read(): Promise<ExecutionDatabase> {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as ExecutionDatabase;
      if (data.version !== 1 || !data.plans || typeof data.plans !== 'object' || Array.isArray(data.plans)) throw new Error('Invalid plan store.');
      if (data.paused !== undefined && typeof data.paused !== 'boolean') throw new Error('Invalid paused state.');
      for (const plan of Object.values(data.plans)) {
        if (plan.nextPlanId && !Object.hasOwn(data.plans, plan.nextPlanId)) throw new Error('Missing recurring successor.');
        ExecutionPlan.parse(plan.definition);
        for (const step of plan.definition.steps) {
          const state = plan.steps?.[step.id];
          if (!state || !['PENDING', 'RUNNING', 'COMPLETED', 'BLOCKED', 'INTERRUPTED'].includes(state.status)
            || !Number.isInteger(state.aiCalls) || state.aiCalls < 0
            || !Number.isFinite(Date.parse(state.updatedAt))
            || (state.successfulActions !== undefined && (!Number.isInteger(state.successfulActions) || state.successfulActions < 0))) throw new Error('Invalid persisted step state.');
        }
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, plans: {} };
      throw error;
    }
  }
  async transaction<T>(action: (data: ExecutionDatabase) => T): Promise<T> {
    return withFileLock(this.file, async () => {
      const data = await this.read(); const result = action(data);
      await atomicJson(this.file, data); return result;
    });
  }
  async add(input: unknown): Promise<void> {
    const plan = ExecutionPlan.parse(input);
    plan.projectRoot = await realpath(plan.projectRoot);
    await this.transaction(data => {
      if (Object.hasOwn(data.plans, plan.id)) throw new Error('Plan id already exists; existing evidence cannot be overwritten.');
      for (const existing of Object.values(data.plans)) {
        const a = process.platform === 'win32' ? existing.definition.projectRoot.toLowerCase() : existing.definition.projectRoot;
        const b = process.platform === 'win32' ? plan.projectRoot.toLowerCase() : plan.projectRoot;
        if (a === b) continue;
        const nested = (parent: string, child: string) => {
          const rel = relative(parent, child);
          return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
        };
        if (nested(a, b) || nested(b, a)) throw new Error('Overlapping project roots must share one project root or use separate worktrees.');
      }
      data.plans[plan.id] = { definition: plan, steps: Object.fromEntries(plan.steps.map(step => [step.id,
        { status: 'PENDING', aiCalls: 0, updatedAt: new Date().toISOString() }])) };
    });
  }
  async enqueueRecurring(now = Date.now()): Promise<void> {
    await this.transaction(data => {
      for (const stored of Object.values(data.plans)) {
        const repeat = stored.definition.recurrence;
        if (!repeat || stored.nextPlanId || !Object.values(stored.steps).every(step => step.status === 'COMPLETED')) continue;
        const nextId = randomUUID();
        const definition = ExecutionPlan.parse({ ...stored.definition, id: nextId,
          notBefore: new Date(now + repeat.intervalMs).toISOString(),
          recurrence: repeat.maxRuns > 2 ? { ...repeat, maxRuns: repeat.maxRuns - 1 } : undefined });
        stored.nextPlanId = nextId;
        data.plans[nextId] = { definition, steps: Object.fromEntries(definition.steps.map(step => [step.id,
          { status: 'PENDING', aiCalls: 0, updatedAt: new Date(now).toISOString() }])) };
      }
    });
  }
  async heartbeat(planId: string, stepId: string): Promise<void> {
    await this.transaction(data => {
      const state = data.plans[planId]?.steps[stepId];
      if (state?.status === 'RUNNING') state.lastHeartbeatAt = new Date().toISOString();
    });
  }
  async update(planId: string, stepId: string, patch: Partial<StepState>): Promise<void> {
    await this.transaction(data => {
      const state = data.plans[planId]?.steps[stepId];
      if (!state) throw new Error('Unknown plan step.');
      Object.assign(state, patch, { updatedAt: new Date().toISOString() });
    });
  }
  async reserveCall(planId: string, stepId: string, limit: number): Promise<void> {
    await this.transaction(data => {
      const state = data.plans[planId]?.steps[stepId];
      if (!state || state.aiCalls >= limit) throw new Error('Persistent AI call budget exhausted. Create a reviewed follow-up plan.');
      state.aiCalls += 1; state.updatedAt = new Date().toISOString();
    });
  }
  async evidence(planId: string, stepId: string, kind: string, data: unknown): Promise<void> {
    // Ids are validated at entry points; validate here too for direct library callers.
    if (![planId, stepId].every(id => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id))) throw new Error('Invalid evidence id.');
    const directory = join(this.directory, 'evidence', planId);
    await mkdir(directory, { recursive: true });
    const record: Evidence = { at: new Date().toISOString(), planId, stepId, kind, data };
    await writeFile(join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
  }
  async history(planId: string): Promise<Evidence[]> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(planId)) throw new Error('Invalid plan id.');
    const directory = join(this.directory, 'evidence', planId);
    let files: string[];
    try { files = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    return Promise.all(files.sort().slice(-100).map(async file => JSON.parse(await readFile(join(directory, file), 'utf8')) as Evidence));
  }
}
