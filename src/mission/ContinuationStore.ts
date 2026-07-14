import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  validateContinuationContract,
  type ContinuationContract,
} from './ContinuationTypes.js';
import type { MissionState } from './MissionStateMachine.js';

export type PersistedContinuationState = {
  schemaVersion: 'keynu-continuation-state.v1';
  missionId: string;
  jobId?: string;
  missionState: MissionState;
  continuation: ContinuationContract;
  autonomousStepCount: number;
  consecutiveFailureCount: number;
  lastProgressAt: string;
  updatedAt: string;
};

export type ContinuationStoreOptions = {
  rootDir?: string;
};

export class ContinuationStore {
  private readonly rootDir: string;

  constructor(options: ContinuationStoreOptions = {}) {
    this.rootDir =
      options.rootDir || join(process.cwd(), '.keynu', 'missions', 'continuations');
  }

  getFilePath(missionId: string): string {
    const safeMissionId = this.validateMissionId(missionId);
    return join(this.rootDir, `${safeMissionId}.json`);
  }

  read(missionId: string): PersistedContinuationState | null {
    const filePath = this.getFilePath(missionId);

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
      return this.validatePersistedState(parsed);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw error;
    }
  }

  write(state: PersistedContinuationState): PersistedContinuationState {
    const validated = this.validatePersistedState(state);
    const filePath = this.getFilePath(validated.missionId);
    const temporaryPath = `${filePath}.tmp`;

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, filePath);

    return validated;
  }

  patch(
    missionId: string,
    patch: Partial<Omit<PersistedContinuationState, 'schemaVersion' | 'missionId'>>,
  ): PersistedContinuationState {
    const current = this.read(missionId);

    if (!current) {
      throw new Error(`Continuation state does not exist for mission: ${missionId}`);
    }

    return this.write({
      ...current,
      ...patch,
      schemaVersion: 'keynu-continuation-state.v1',
      missionId: current.missionId,
      updatedAt: new Date().toISOString(),
    });
  }

  record(
    missionId: string,
    missionState: MissionState,
    continuation: ContinuationContract,
    options: {
      jobId?: string;
      autonomousStepCount?: number;
      consecutiveFailureCount?: number;
      lastProgressAt?: string;
    } = {},
  ): PersistedContinuationState {
    const now = new Date().toISOString();
    const previous = this.read(missionId);

    return this.write({
      schemaVersion: 'keynu-continuation-state.v1',
      missionId,
      jobId: options.jobId,
      missionState,
      continuation,
      autonomousStepCount:
        options.autonomousStepCount ?? previous?.autonomousStepCount ?? 0,
      consecutiveFailureCount:
        options.consecutiveFailureCount ?? previous?.consecutiveFailureCount ?? 0,
      lastProgressAt: options.lastProgressAt ?? previous?.lastProgressAt ?? now,
      updatedAt: now,
    });
  }

  private validateMissionId(value: string): string {
    const trimmed = value.trim();

    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
      throw new Error('Mission identifier contains unsupported characters.');
    }

    return trimmed;
  }

  private validatePersistedState(value: unknown): PersistedContinuationState {
    if (!value || typeof value !== 'object') {
      throw new Error('Persisted continuation state must be an object.');
    }

    const candidate = value as Partial<PersistedContinuationState>;

    if (candidate.schemaVersion !== 'keynu-continuation-state.v1') {
      throw new Error('Unsupported continuation state schema version.');
    }

    if (typeof candidate.missionId !== 'string') {
      throw new Error('Persisted continuation state requires missionId.');
    }

    this.validateMissionId(candidate.missionId);

    if (typeof candidate.missionState !== 'string') {
      throw new Error('Persisted continuation state requires missionState.');
    }

    if (!Number.isInteger(candidate.autonomousStepCount) || candidate.autonomousStepCount! < 0) {
      throw new Error('autonomousStepCount must be a non-negative integer.');
    }

    if (
      !Number.isInteger(candidate.consecutiveFailureCount) ||
      candidate.consecutiveFailureCount! < 0
    ) {
      throw new Error('consecutiveFailureCount must be a non-negative integer.');
    }

    if (typeof candidate.lastProgressAt !== 'string' || !candidate.lastProgressAt) {
      throw new Error('Persisted continuation state requires lastProgressAt.');
    }

    if (typeof candidate.updatedAt !== 'string' || !candidate.updatedAt) {
      throw new Error('Persisted continuation state requires updatedAt.');
    }

    return {
      ...candidate,
      continuation: validateContinuationContract(candidate.continuation),
    } as PersistedContinuationState;
  }
}
