export type DriverResult = {
  success: boolean;
  message?: string;
  data?: unknown;
};

export interface Driver {
  readonly id: string;

  initialize(): Promise<void>;

  execute(command: unknown): Promise<DriverResult>;
}
