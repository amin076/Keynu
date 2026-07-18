import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { decideMissionBootstrap } from "../MissionBootstrapPolicy.js";

const oldUrl = "https://chatgpt.com/c/old";
const newUrl = "https://chatgpt.com/c/new";
const decision = decideMissionBootstrap(
  { conversationUrl: oldUrl, memoryRestored: true },
  newUrl,
);

assert.equal(decision.isSameConversation, false);
assert.equal(decision.shouldRestoreMission, true);

const entry = readFileSync("src/browser/runBrowserAgent.ts", "utf8");
assert.equal(entry.includes("sessionStore.patch({ conversationUrl })"), false);

console.log("New-conversation bootstrap regression tests passed.");
