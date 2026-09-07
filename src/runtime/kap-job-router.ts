import { executeFileSystemRequest } from '../drivers/filesystem/filesystem-runtime-adapter.js';
import type { FileSystemRequest } from '../drivers/filesystem/filesystem-types.js';
import { handlePowerShellKapJob } from '../drivers/powershell/powershell-runtime-adapter.js';
import type { PowerShellProgressEvent } from '../drivers/powershell/powershell-patch.js';
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

export type KapJobProgressEvent = PowerShellProgressEvent | {
  stage: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  phase: string;
  index?: number;
  total?: number;
  name?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export type RouteKapJobOptions = {
  onProgress?: (event: KapJobProgressEvent) => void | Promise<void>;
};

async function emitProgress(
  options: RouteKapJobOptions,
  event: KapJobProgressEvent,
): Promise<void> {
  if (!options.onProgress) return;
  try {
    await options.onProgress(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[kap-job-router] progress callback failed: ${message}`);
  }
}

export async function executeKapCommandJob(
  job: KapCommandJob,
  options: RouteKapJobOptions = {},
) {
  const rawResults: any[] = [];

  let commandChainFailed = false;
  for (let index = 0; index < job.commands.length; index += 1) {
    const command = job.commands[index];
    const ordinal = index + 1;
    const name = [command.command, ...(command.args ?? [])].join(' ');

    if (commandChainFailed && job.continueOnError !== true && command.runAfterFailure !== true) {
      rawResults.push({
        command: command.command,
        args: command.args ?? [],
        ok: false,
        blocked: true,
        skipped: true,
        error: "Skipped because a previous command failed",
      });
      await emitProgress(options, {
        stage: 'SKIPPED',
        phase: 'command',
        index: ordinal,
        total: job.commands.length,
        name,
        message: 'Skipped because a previous command failed',
      });
      continue;
    }

    await emitProgress(options, {
      stage: 'STARTED',
      phase: 'command',
      index: ordinal,
      total: job.commands.length,
      name,
    });

    const result = await executeCommand(command, job.cwd);
    rawResults.push(result);
    if (!result.ok) commandChainFailed = true;

    await emitProgress(options, {
      stage: result.ok ? 'COMPLETED' : 'FAILED',
      phase: 'command',
      index: ordinal,
      total: job.commands.length,
      name,
      message: result.ok ? undefined : result.error,
    });
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

export async function routeKapJob(
  job: KapJob,
  options: RouteKapJobOptions = {},
) {
  if (job.protocol !== 'KAP' || job.type !== 'JOB') {
    throw new Error('Invalid KAP job envelope');
  }

  if (job.payload.target === 'powershell') {
    return handlePowerShellKapJob(job as any, {
      onProgress: options.onProgress,
    });
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
    }, options);
  }

  if (job.payload.target === 'filesystem') {
    const cwd = job.payload.cwd;
    const request = job.payload.request;

    if (typeof cwd !== 'string' || !request || typeof request !== 'object') {
      throw new Error('target=filesystem requires payload.cwd and payload.request');
    }

    await emitProgress(options, {
      stage: 'STARTED',
      phase: 'filesystem',
      index: 1,
      total: 1,
      name: 'filesystem request',
    });

    try {
      const result = await executeFileSystemRequest(
        cwd,
        request as FileSystemRequest,
      );

      await emitProgress(options, {
        stage: 'COMPLETED',
        phase: 'filesystem',
        index: 1,
        total: 1,
        name: 'filesystem request',
      });

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
    } catch (error) {
      await emitProgress(options, {
        stage: 'FAILED',
        phase: 'filesystem',
        index: 1,
        total: 1,
        name: 'filesystem request',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  throw new Error('Unsupported KAP target: ' + job.payload.target);
}
