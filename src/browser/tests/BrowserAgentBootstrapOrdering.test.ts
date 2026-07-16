import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync("src/browser/BrowserAgentApp.ts", "utf8");
const agent = readFileSync("src/browser/BrowserAgent.ts", "utf8");
const watcher = readFileSync("src/browser/ConversationWatcher.ts", "utf8");

const seedIndex = app.indexOf("await agent.seedWatcherBaseline();");
const bootstrapIndex = app.indexOf("await this.sendMissionBootstrap(");
const startIndex = app.indexOf("await agent.start();");

assert.equal(seedIndex >= 0, true);
assert.equal(bootstrapIndex >= 0, true);
assert.equal(startIndex >= 0, true);
assert.equal(seedIndex < bootstrapIndex, true);
assert.equal(bootstrapIndex < startIndex, true);
assert.match(agent, /this\.browser\.getWatcher\(\)\.seedBaseline\(\)/);
assert.match(watcher, /this\.memory\.remember\(latest\.id\)/);

console.log("PASS BrowserAgentBootstrapOrdering");
