import type { KapEnvelope } from '../kap/KapEnvelope.js';
import { validateKapEnvelope } from '../kap/KapValidator.js';
import type { KapBlock } from './KapInterpreter.js';

export type KapValidationError = {
  blockIndex: number;
  blockId?: string;
  field: string;
  message: string;
};

export type ValidatedKapBlock = {
  block: KapBlock;
  envelope: KapEnvelope;
};

export type KapValidationOutcome =
  | {
      valid: true;
      value: ValidatedKapBlock;
      errors: [];
    }
  | {
      valid: false;
      block: KapBlock;
      errors: KapValidationError[];
    };

function issueToError(block: KapBlock, issue: string): KapValidationError {
  const [field, ...rest] = issue.split(':');
  return {
    blockIndex: block.index,
    blockId: block.id,
    field: field?.trim() || 'envelope',
    message: rest.join(':').trim() || issue,
  };
}

function requiredFieldErrors(block: KapBlock, value: unknown): KapValidationError[] {
  if (!value || typeof value !== 'object') {
    return [{
      blockIndex: block.index,
      blockId: block.id,
      field: 'envelope',
      message: 'KAP block must contain a JSON object.',
    }];
  }

  const item = value as Record<string, unknown>;
  const errors: KapValidationError[] = [];

  for (const field of ['protocol', 'version', 'type', 'payload']) {
    if (!(field in item)) {
      errors.push({
        blockIndex: block.index,
        blockId: block.id,
        field,
        message: `${field} is required.`,
      });
    }
  }

  return errors;
}

export class KapValidator {
  validate(block: KapBlock): KapValidationOutcome {
    if (block.parseError) {
      return {
        valid: false,
        block,
        errors: [{
          blockIndex: block.index,
          blockId: block.id,
          field: 'json',
          message: block.parseError,
        }],
      };
    }

    const requiredErrors = requiredFieldErrors(block, block.parsed);
    if (requiredErrors.length > 0) {
      return {
        valid: false,
        block,
        errors: requiredErrors,
      };
    }

    const validation = validateKapEnvelope(block.parsed);

    if (!validation.valid) {
      return {
        valid: false,
        block,
        errors: validation.issues.map((issue) => issueToError(block, issue)),
      };
    }

    return {
      valid: true,
      value: {
        block,
        envelope: validation.value as KapEnvelope,
      },
      errors: [],
    };
  }

  validateAll(blocks: KapBlock[]): KapValidationOutcome[] {
    return blocks.map((block) => this.validate(block));
  }
}
