import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const implementation = readFileSync(
  "src/browser/ConversationManager.ts",
  "utf8",
);

assert.match(implementation, /CHATGPT_COMPOSER_SELECTOR/);
assert.match(implementation, /#prompt-textarea:visible/);
assert.match(implementation, /ProseMirror\[contenteditable=/);
assert.match(implementation, /data-virtualkeyboard/);
assert.match(implementation, /form \[contenteditable=/);
assert.match(implementation, /textarea:visible/);
assert.match(implementation, /locator\(CHATGPT_COMPOSER_SELECTOR\)/);
assert.equal(
  /locator\(["']textarea(?::visible)?["']\)/.test(implementation),
  false,
  "ConversationManager must not depend exclusively on textarea selectors.",
);

console.log("PASS ConversationManagerComposerSelectors");
