import { BrowserAgentApp } from "./BrowserAgentApp.js";
import { printBrowserAgentMissingUrlHelp } from "./BrowserAgentHelp.js";

const conversationUrl = process.env.KEYNU_CONVERSATION_URL;

if (!conversationUrl) {
  printBrowserAgentMissingUrlHelp();
  process.exit(1);
}

const app = new BrowserAgentApp({
  conversationUrl,
});

await app.start();
