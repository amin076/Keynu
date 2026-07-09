export interface Driver<TTask = unknown, TResult = unknown> {
  readonly id: string;
  readonly version: string;

  initialize(): Promise<void>;

  execute(task: TTask): Promise<TResult>;

  shutdown(): Promise<void>;
}