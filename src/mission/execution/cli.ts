import { executionApiServer } from './ExecutionApiServer.js';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { createBuiltinFunctions } from '../../engineering/functions/BuiltinFunctions.js';
import { registerScript, ScriptDefinition } from '../../engineering/functions/ScriptFunctions.js';
import { OpenAIProvider } from '../../providers/openai/OpenAIProvider.js';
import { loadOpenAIConfigurationFromEnv } from '../../providers/openai/OpenAIConfiguration.js';
import { ExecutionPlan } from './ExecutionPlan.js';
import { ExecutionPlanStore } from './ExecutionPlanStore.js';
import { ApiExecutionAgent } from './ApiExecutionAgent.js';
import { MissionExecutionRunner } from './MissionExecutionRunner.js';

const Config = z.object({ stateDirectory: z.string().default('.keynu/execution'),
  concurrency: z.number().int().min(1).max(4).default(3),
  scripts: z.array(ScriptDefinition).default([]),
  apiProjects: z.array(z.object({ root: z.string(), allowedFunctions: z.array(z.string()).min(1) }).strict()).default([]),
}).strict();

async function main(): Promise<void> {
  const [command, configPath, ...args] = process.argv.slice(2);
  if (!configPath || !['add', 'status', 'run', 'watch', 'resume', 'serve'].includes(command ?? '')) {
    throw new Error('Usage: npm run mission -- <add|status|run|watch|resume|serve> config.json [plan.json | planId stepId]');
  }
  const base = dirname(resolve(configPath));
  const config = Config.parse(JSON.parse(await readFile(configPath, 'utf8')));
  const store = new ExecutionPlanStore(resolve(base, config.stateDirectory));
  if (command === 'status') { console.log(JSON.stringify(await store.read(), null, 2)); return; }
  if (command === 'add') {
    if (!args[0]) throw new Error('Plan file required.');
    const plan = ExecutionPlan.parse(JSON.parse(await readFile(args[0], 'utf8')));
    plan.projectRoot = await realpath(resolve(dirname(resolve(args[0])), plan.projectRoot));
    await store.add(plan); console.log(`Plan added: ${plan.id}`); return;
  }
  const registry = createBuiltinFunctions();
  for (const script of config.scripts) await registerScript(registry, { ...script, script: resolve(base, script.script) });
  // Resume is a local state operation and does not require API credentials.
  if (command === 'resume') {
    const unavailable = { decide: async (): Promise<never> => { throw new Error('No provider'); },
      review: async (): Promise<never> => { throw new Error('No provider'); } };
    if (!args[0] || !args[1]) throw new Error('Plan id and step id required.');
    await new MissionExecutionRunner(store, registry, unavailable, config.concurrency).resume(args[0], args[1]);
    console.log('Step resumed; persistent budget unchanged.'); return;
  }
  const loaded = loadOpenAIConfigurationFromEnv();
  if (loaded.status !== 'available') throw new Error(loaded.diagnostics.join(' '));
  // The plan budgets every request. Transport-level retries must not hide extra calls.
  const worker = new OpenAIProvider({ config: { ...loaded.config, timeoutMs: loaded.config.timeoutMs || 60000, retryCount: 0 } });
  const reviewer = new OpenAIProvider({ config: { ...loaded.config,
    model: process.env.OPENAI_REVIEW_MODEL?.trim() || loaded.config.model, timeoutMs: loaded.config.timeoutMs || 60000, retryCount: 0 } });
  const runner = new MissionExecutionRunner(store, registry, new ApiExecutionAgent(worker, reviewer), config.concurrency);
  if (command === 'serve') {
    const port = z.coerce.number().int().min(1).max(65535).parse(process.env.KEYNU_API_PORT ?? 4788);
    const server = executionApiServer(runner, process.env.KEYNU_API_TOKEN ?? '',
      config.apiProjects.map(project => ({ ...project, root: resolve(base, project.root) })));
    server.listen(port, '127.0.0.1', () => console.log(`Keynu execution API listening on 127.0.0.1:${port}`));
    const close = () => server.close();
    process.once('SIGINT', close); process.once('SIGTERM', close);
    return;
  }
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
  do {
    await runner.run(controller.signal);
    console.log(JSON.stringify(await store.read(), null, 2));
    if (command !== 'watch' || controller.signal.aborted) break;
    try { await delay(5000, undefined, { signal: controller.signal }); } catch { break; }
  } while (!controller.signal.aborted);
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
