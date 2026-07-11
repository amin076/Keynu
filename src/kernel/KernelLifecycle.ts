export interface KernelLifecycle {
  boot(): Promise<void>;
  shutdown(): Promise<void>;
}
