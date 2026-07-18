export type APIMessageRole =
  | 'system'
  | 'developer'
  | 'user'
  | 'assistant'
  | 'tool'
  | (string & {});

export type APIMessageContent =
  | string
  | Array<{
      type: string;
      text?: string;
      data?: unknown;
      metadata?: Record<string, unknown>;
    }>;

export type APIMessage = {
  id?: string;
  role: APIMessageRole;
  content: APIMessageContent;
  name?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export function createAPIMessage(
  role: APIMessageRole,
  content: APIMessageContent,
  patch: Omit<APIMessage, 'role' | 'content'> = {},
): APIMessage {
  return {
    role,
    content,
    ...patch,
  };
}
