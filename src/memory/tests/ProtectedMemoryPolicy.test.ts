import { strict as assert } from "node:assert";

import {
  evaluateProtectedMemoryWrite,
  isProtectedMemoryPath,
  sha256Text,
} from "../ProtectedMemoryPolicy.js";

assert.equal(isProtectedMemoryPath(".keynu/memory/current_state.md"), true);
assert.equal(isProtectedMemoryPath(".keynu\\memory\\next_steps.md"), true);
assert.equal(isProtectedMemoryPath("src/example.ts"), false);

const blockedReplace = evaluateProtectedMemoryWrite({
  relativePath: ".keynu/memory/current_state.md",
  existingContent: "existing mission memory\n",
  incomingContent: "replacement\n",
});
assert.equal(blockedReplace.allowed, false);
assert.match(blockedReplace.reason ?? "", /explicit authorization/i);

const append = evaluateProtectedMemoryWrite({
  relativePath: ".keynu/memory/current_state.md",
  existingContent: "existing mission memory\n",
  incomingContent: "new checkpoint\n",
  mode: "append",
});
assert.equal(append.allowed, true);
assert.equal(
  append.resultingContent,
  "existing mission memory\nnew checkpoint\n",
);
assert.equal(append.resultingSha256, sha256Text(append.resultingContent ?? ""));

const authorizedReplace = evaluateProtectedMemoryWrite({
  relativePath: ".keynu/memory/current_state.md",
  existingContent: "old",
  incomingContent: "new",
  mode: "replace",
  allowProtectedReplace: true,
});
assert.equal(authorizedReplace.allowed, true);
assert.equal(authorizedReplace.resultingContent, "new");

const conflict = evaluateProtectedMemoryWrite({
  relativePath: ".keynu/memory/current_state.md",
  existingContent: "current",
  incomingContent: "next",
  mode: "append",
  expectedSha256: sha256Text("stale"),
});
assert.equal(conflict.allowed, false);
assert.match(conflict.reason ?? "", /SHA-256/i);

const normalReplace = evaluateProtectedMemoryWrite({
  relativePath: "src/example.ts",
  existingContent: "old",
  incomingContent: "new",
});
assert.equal(normalReplace.allowed, true);
assert.equal(normalReplace.resultingContent, "new");

console.log("PASS ProtectedMemoryPolicy");
