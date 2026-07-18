import { APIConversation } from '../api/APIConversation.js';
import type { APIMessage } from '../api/APIMessage.js';

export class OpenAIConversation extends APIConversation {
  toInput(): APIMessage[] {
    return this.getMessages();
  }
}
