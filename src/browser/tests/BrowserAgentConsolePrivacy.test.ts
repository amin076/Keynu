import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/browser/BrowserAgent.ts", "utf8");

assert(!source.includes("[agent] Message length:"));
assert(!source.includes("[agent] Message preview:"));
assert(!source.includes("messageText.slice("));
assert(source.includes("[agent] Assistant message received."));
assert(source.includes("[agent] KAP job extracted:"));

console.log("BrowserAgent console privacy tests passed.");
