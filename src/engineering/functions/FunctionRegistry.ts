import { z } from 'zod';

export type FunctionContext = { projectRoot: string };
export type FunctionResult = { ok: boolean; summary: string; data?: unknown };
type RegisteredFunction = {
  description: string;
  parameters: z.ZodType;
  execute: (args: any, context: FunctionContext) => Promise<FunctionResult>;
};

/** Code-owned registry: model outputs select capabilities, never register code. */
export class FunctionRegistry {
  private readonly functions = new Map<string, RegisteredFunction>();
  register(name: string, definition: RegisteredFunction): void {
    if (!/^[a-z][a-zA-Z0-9.]{1,80}$/.test(name) || this.functions.has(name)) {
      throw new Error(`Invalid or duplicate function: ${name}`);
    }
    this.functions.set(name, definition);
  }
  describe(allowed: string[]): unknown[] {
    return allowed.map(name => {
      const fn = this.functions.get(name);
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return { name, description: fn.description, parameters: z.toJSONSchema(fn.parameters) };
    });
  }
  async invoke(name: string, args: unknown, context: FunctionContext, allowed: string[]): Promise<FunctionResult> {
    if (!allowed.includes(name)) throw new Error(`Function not allowed for this step: ${name}`);
    const fn = this.functions.get(name);
    if (!fn) throw new Error(`Unknown function: ${name}`);
    return fn.execute(fn.parameters.parse(args), context);
  }
}
