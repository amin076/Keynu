export type Handler = (payload: unknown) => Promise<void>;

export class HandlerRegistry {
  private readonly handlers = new Map<string, Handler>();

  register(capability: string, handler: Handler): void {
    this.handlers.set(capability, handler);
  }

  get(capability: string): Handler | undefined {
    return this.handlers.get(capability);
  }

  has(capability: string): boolean {
    return this.handlers.has(capability);
  }

  unregister(capability: string): boolean {
    return this.handlers.delete(capability);
  }

  clear(): void {
    this.handlers.clear();
  }

  getAll(): string[] {
    return [...this.handlers.keys()];
  }
}