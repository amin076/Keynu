import { processBrowserMessageForKapJobs } from "./kap-browser-runtime-bridge.js";

export async function createKapRuntimeReplyForAssistantMessage(messageText: string) {
  const reply = await processBrowserMessageForKapJobs(messageText, { dedupe: true });
  return reply.trim().length > 0 ? reply : null;
}

/*
Integration point for the existing BrowserAgent:

1. After BrowserAgent reads the latest assistant message, call:

   const reply = await createKapRuntimeReplyForAssistantMessage(latestAssistantText);

2. If reply is not null, paste/send it back to the same ChatGPT conversation.

This keeps the real BrowserAgent code small and avoids duplicating Playwright logic here.
*/
