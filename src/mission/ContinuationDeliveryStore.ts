import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type ContinuationDeliveryStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED';

export type ContinuationDeliveryRecord = {
  schemaVersion: 'keynu-continuation-delivery.v1';
  requestId: string;
  missionId: string;
  resumeToken: string;
  status: ContinuationDeliveryStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  failedAt?: string;
  lastError?: string;
};

export type ContinuationDeliveryStoreOptions = {
  rootDir?: string;
};

function validateIdentifier(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`${label} contains unsafe characters.`);
  }
  return normalized;
}

export class ContinuationDeliveryStore {
  private readonly rootDir: string;

  constructor(options: ContinuationDeliveryStoreOptions = {}) {
    this.rootDir =
      options.rootDir ||
      join(process.cwd(), '.keynu', 'missions', 'continuation-deliveries');
  }

  private getFilePath(requestId: string): string {
    return join(
      this.rootDir,
      `${validateIdentifier('requestId', requestId)}.json`,
    );
  }

  read(requestId: string): ContinuationDeliveryRecord | null {
    const file = this.getFilePath(requestId);
    if (!existsSync(file)) return null;

    const parsed = JSON.parse(
      readFileSync(file, 'utf8'),
    ) as ContinuationDeliveryRecord;

    if (parsed.schemaVersion !== 'keynu-continuation-delivery.v1') {
      throw new Error('Unsupported continuation delivery schema.');
    }

    return parsed;
  }

  private write(record: ContinuationDeliveryRecord): ContinuationDeliveryRecord {
    const file = this.getFilePath(record.requestId);
    const temporaryFile = `${file}.tmp`;

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temporaryFile, JSON.stringify(record, null, 2), 'utf8');
    renameSync(temporaryFile, file);

    return record;
  }

  reserve(input: {
    requestId: string;
    missionId: string;
    resumeToken: string;
  }): { created: boolean; record: ContinuationDeliveryRecord } {
    const existing = this.read(input.requestId);
    if (existing) return { created: false, record: existing };

    const now = new Date().toISOString();
    const record: ContinuationDeliveryRecord = {
      schemaVersion: 'keynu-continuation-delivery.v1',
      requestId: validateIdentifier('requestId', input.requestId),
      missionId: validateIdentifier('missionId', input.missionId),
      resumeToken: validateIdentifier('resumeToken', input.resumeToken),
      status: 'PENDING',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return { created: true, record: this.write(record) };
  }

  markAttempt(requestId: string): ContinuationDeliveryRecord {
    const current = this.read(requestId);
    if (!current) throw new Error(`Unknown continuation request: ${requestId}`);

    return this.write({
      ...current,
      attemptCount: current.attemptCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  markDelivered(requestId: string): ContinuationDeliveryRecord {
    const current = this.read(requestId);
    if (!current) throw new Error(`Unknown continuation request: ${requestId}`);

    const now = new Date().toISOString();
    return this.write({
      ...current,
      status: 'DELIVERED',
      deliveredAt: now,
      failedAt: undefined,
      lastError: undefined,
      updatedAt: now,
    });
  }

  markFailed(requestId: string, error: unknown): ContinuationDeliveryRecord {
    const current = this.read(requestId);
    if (!current) throw new Error(`Unknown continuation request: ${requestId}`);

    const now = new Date().toISOString();
    return this.write({
      ...current,
      status: 'FAILED',
      failedAt: now,
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: now,
    });
  }

  shouldDeliver(requestId: string): boolean {
    const current = this.read(requestId);
    return !current || current.status !== 'DELIVERED';
  }
}
