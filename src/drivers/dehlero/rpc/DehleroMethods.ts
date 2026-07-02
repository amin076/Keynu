export const DehleroMethods = {
  Ping: "ping",
  Run: "run",
  Status: "status",
  Stop: "stop",
} as const;

export type DehleroMethod =
  typeof DehleroMethods[keyof typeof DehleroMethods];