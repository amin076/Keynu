import { executeFileSystemRequest } from '../drivers/filesystem/filesystem-runtime-adapter.js';
import type { FileSystemRequest } from '../drivers/filesystem/filesystem-types.js';
import { handlePowerShellKapJob } from '../drivers/powershell/powershell-runtime-adapter.js';
import type { CommandSpec } from './CommandSpec.js';
import { executeCommand } from './CommandExecutor.js';
import { compactCommandResult } from './CompactReport.js';

export type KapJob = {
  protocol: 'KAP';
  version: string;
  type: 'JOB';
  id: string;
  createdAt?: string;
  payload: {
    target: string;
    cwd?: string;
    commands?: CommandSpec[];
    [key: string]: unknown;
  };
};

export type KapCommandJob = {
  jobId: string;
  cwd: string;
  commands: CommandSpec[];
  continueOnError?: boolean;
};

export async function executeKapCommandJob(job: KapCommandJob) {
  const rawResults: any[] = [];

  let commandChainFailed = false;
  for (const command of job.commands) {
    if (commandChainFailed && job.continueOnError !== true && command.runAfterFailure !== true) {
      rawResults.push({
        command: command.command,
        args: command.args ?? [],
        ok: false,
        blocked: true,
        skipped: true,
        error: "Skipped because a previous command failed",
      });
      continue;
    }

    const result = await executeCommand(command, job.cwd);
    rawResults.push(result);
    if (!result.ok) commandChainFailed = true;
  }

  const ok = rawResults.every((result) => result.ok);
  const results = rawResults.map(compactCommandResult);

  return {
    protocol: 'KAP',
    version: '1.0',
    type: 'REPORT',
    id: `report-${job.jobId}`,
    createdAt: new Date().toISOString(),
    payload: {
      jobId: job.jobId,
      target: 'commands',
      status: ok ? 'COMPLETED' : 'FAILED',
      result: {
        ok,
        commandCount: results.length,
        results,
      },
    },
  };
}

export async function routeKapJob(job: KapJob) {
  if (job.protocol !== 'KAP' || job.type !== 'JOB') {
    throw new Error('Invalid KAP job envelope');
  }

  if (job.payload.target === 'powershell') {
    return handlePowerShellKapJob(job as any);
  }

  if (job.payload.target === 'commands') {
    const cwd = job.payload.cwd;
    const commands = job.payload.commands;

    if (typeof cwd !== 'string' || !Array.isArray(commands)) {
      throw new Error('target=commands requires payload.cwd and payload.commands');
    }

    return executeKapCommandJob({
      jobId: job.id,
      cwd,
      commands,
      continueOnError: job.payload.continueOnError === true,
    });
  }

  if (job.payload.target === 'filesystem') {
    const cwd = job.payload.cwd;
    const request = job.payload.request;

    if (typeof cwd !== 'string' || !request || typeof request !== 'object') {
      throw new Error('target=filesystem requires payload.cwd and payload.request');
    }

    const result = await executeFileSystemRequest(
      cwd,
      request as FileSystemRequest,
    );

    return {
      protocol: 'KAP',
      version: job.version,
      type: 'REPORT',
      id: 'report-' + job.id,
      createdAt: new Date().toISOString(),
      payload: {
        jobId: job.id,
        target: 'filesystem',
        status: 'COMPLETED',
        result,
      },
    };
  }

  throw new Error('Unsupported KAP target: ' + job.payload.target);
}
