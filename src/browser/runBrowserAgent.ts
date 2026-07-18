import { BrowserAgentApp } from "./BrowserAgentApp.js";
import { printBrowserAgentMissingUrlHelp } from "./BrowserAgentHelp.js";
import { SessionStore } from "../session/index.js";

const sessionStore = new SessionStore();
const session = sessionStore.read();
const conversationUrl = process.env.KEYNU_CONVERSATION_URL ?? session.conversationUrl;

if (!conversationUrl) {
  printBrowserAgentMissingUrlHelp();
  process.exit(1);
}



const app = new BrowserAgentApp({ conversationUrl });
await app.start();
