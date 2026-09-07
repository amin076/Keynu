import { strict as assert } from "node:assert";
import { ProviderRuntime } from "../../runtime/ProviderRuntime.js";
import type { ProviderResponse } from "../../providers/api/ProviderResponse.js";

function response(content: string, id: string): ProviderResponse {
  return {
    id,
    requestId: `request-${id}`,
    providerId: "browser-agent-chatgpt",
    content,
    createdAt: new Date().toISOString(),
  };
}

const runtime = new ProviderRuntime();

const prose = await runtime.execute(
  response("This is an ordinary ChatGPT explanation, not a KAP command.", "prose"),
  { source: "browser-agent" },
);

assert.equal(prose.items.length, 1);
assert.equal(prose.items[0]?.envelope.type, "IGNORED");
assert.equal(prose.items[0]?.action, "UNHANDLED");
assert.equal(prose.items[0]?.status, "SKIPPED");
assert.match(
  prose.items[0]?.message ?? "",
  /ignored without requesting recovery/i,
);

const malformed = await runtime.execute(
  response("```kap\n{ definitely-not-valid-json }\n```", "malformed"),
  { source: "browser-agent" },
);

assert.equal(malformed.items.length, 1);
assert.equal(malformed.items[0]?.envelope.type, "IGNORED");
assert.equal(malformed.items[0]?.action, "UNHANDLED");

const genericProvider = await runtime.execute(
  response("Ordinary provider prose", "generic"),
  { source: "unit-test" },
);
assert.equal(
  genericProvider.items.length,
  0,
  "Non-browser ProviderRuntime callers must preserve the existing no-KAP behavior.",
);

console.log("PASS BrowserAgentNonKapRecovery safe-ignore policy");
