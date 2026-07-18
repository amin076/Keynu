import {
  createAPIMessage,
  type APIMessage,
  type APIMessageContent,
  type APIMessageRole,
} from './APIMessage.js';

export type APIConversationSnapshot = {
  id: string;
  messages: APIMessage[];
  metadata?: Record<string, unknown>;
};

export class APIConversation {
  private readonly messages: APIMessage[] = [];

  constructor(
    readonly id: string,
    private readonly metadata?: Record<string, unknown>,
  ) {}

  addMessage(message: APIMessage): APIMessage {
    this.messages.push({
      ...message,
      createdAt: message.createdAt ?? new Date().toISOString(),
    });
    return this.messages[this.messages.length - 1];
  }

  add(
    role: APIMessageRole,
    content: APIMessageContent,
    patch: Omit<APIMessage, 'role' | 'content'> = {},
  ): APIMessage {
    return this.addMessage(createAPIMessage(role, content, patch));
  }

  system(content: APIMessageContent, patch: Omit<APIMessage, 'role' | 'content'> = {}): APIMessage {
    return this.add('system', content, patch);
  }

  developer(content: APIMessageContent, patch: Omit<APIMessage, 'role' | 'content'> = {}): APIMessage {
    return this.add('developer', content, patch);
  }

  user(content: APIMessageContent, patch: Omit<APIMessage, 'role' | 'content'> = {}): APIMessage {
    return this.add('user', content, patch);
  }

  assistant(content: APIMessageContent, patch: Omit<APIMessage, 'role' | 'content'> = {}): APIMessage {
    return this.add('assistant', content, patch);
  }

  tool(content: APIMessageContent, patch: Omit<APIMessage, 'role' | 'content'> = {}): APIMessage {
    return this.add('tool', content, patch);
  }

  getMessages(): APIMessage[] {
    return this.messages.map((message) => ({ ...message }));
  }

  snapshot(): APIConversationSnapshot {
    return {
      id: this.id,
      messages: this.getMessages(),
      metadata: this.metadata,
    };
  }
}
