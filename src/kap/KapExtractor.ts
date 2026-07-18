import type { KapEnvelope } from './KapEnvelope.js';
import { KapInterpreter } from '../runtime/KapInterpreter.js';
import { KapValidator } from '../runtime/KapValidator.js';

const interpreter = new KapInterpreter();
const validator = new KapValidator();

export function extractKapEnvelope(text: string): KapEnvelope | null {
  for (const block of interpreter.interpret(text).blocks) {
    const validation = validator.validate(block);
    if (validation.valid) return validation.value.envelope;
  }

  return null;
}
