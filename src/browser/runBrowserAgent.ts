import { BrowserAgentApp } from "./BrowserAgentApp.js";

const conversationUrl = process.env.KEYNU_CONVERSATION_URL;

if (!conversationUrl) {
  console.error("");
  console.error("Missing KEYNU_CONVERSATION_URL.");
  console.error("");
  console.error("Example:");
  console.error(
    '  $env:KEYNU_CONVERSATION_URL="https://chatgpt.com/c/YOUR_CONVERSATION_ID"',
  );
  console.error("  npm run browser-agent");
  console.error("");
  process.exit(1);
}

const app = new BrowserAgentApp({
  conversationUrl,
});

await app.start();
