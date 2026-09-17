import { createServer, type IncomingMessage, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { z } from 'zod';
import { ExecutionPlan } from './ExecutionPlan.js';
import type { MissionExecutionRunner } from './MissionExecutionRunner.js';

export type ApiProject = { root: string; allowedFunctions: string[] };
async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 65536) throw new Error('Request body exceeds 64 KiB.');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function executionApiServer(runner: MissionExecutionRunner, token: string, projects: ApiProject[]): Server {
  if (token.length < 32) throw new Error('KEYNU_API_TOKEN must contain at least 32 characters.');
  let running = false;
  let lastRunError: string | undefined;
  const controller = new AbortController();
  const server = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    response.setHeader('cache-control', 'no-store');
    const send = (status: number, data: unknown) => { response.writeHead(status); response.end(JSON.stringify(data)); };
    const auth = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (request.headers.origin || auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
      send(401, { error: 'Unauthorized' }); return;
    }
    try {
      const route = `${request.method} ${request.url}`;
      if (route === 'GET /health') { send(200, { ok: true, running, lastRunError }); return; }
      if (route === 'GET /plans') { send(200, await runner.store.read()); return; }
      if (route === 'POST /plans') {
        const plan = ExecutionPlan.parse(await body(request));
        plan.projectRoot = await realpath(plan.projectRoot);
        let approved: ApiProject | undefined;
        for (const project of projects) if (await realpath(project.root) === plan.projectRoot) approved = project;
        if (!approved || plan.steps.some(step => step.allowedFunctions.some(name => !approved!.allowedFunctions.includes(name)))) {
          send(403, { error: 'Project or functions outside configured API scope.' }); return;
        }
        await runner.store.add(plan); send(201, { id: plan.id }); return;
      }
      if (route === 'POST /run') {
        if (running) { send(409, { error: 'Worker already running.' }); return; }
        running = true; lastRunError = undefined;
        void runner.run(controller.signal).catch(error => {
          lastRunError = error instanceof Error ? error.message : String(error);
        }).finally(() => { running = false; });
        send(202, { accepted: true }); return;
      }
      if (route === 'POST /resume') {
        const value = z.object({ planId: z.string().min(1), stepId: z.string().min(1) }).strict().parse(await body(request));
        if (running) { send(409, { error: 'Worker already running.' }); return; }
        await runner.resume(value.planId, value.stepId); send(200, { resumed: true }); return;
      }
      send(404, { error: 'Unknown route.' });
    } catch (error) { send(400, { error: error instanceof Error ? error.message : String(error) }); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000;
  server.on('close', () => controller.abort());
  return server;
}
