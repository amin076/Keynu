import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { validateAppManifest } from "../AppRegistry.js";
import { ExecutionPlan } from "../../mission/execution/ExecutionPlan.js";

const manifest = validateAppManifest(JSON.parse(
  await readFile("config/integrations/esbiko.json", "utf8"),
));
assert.equal(manifest.id, "esbiko");
assert.deepEqual(
  manifest.capabilities.map(capability => capability.name),
  ["build", "lint", "simulationCheck", "platformApiTest", "webmcpTest"],
);
assert.ok(manifest.capabilities.every(capability => capability.risk === "execute"));

const plan = ExecutionPlan.parse(JSON.parse(
  await readFile("examples/esbiko/esbiko-real-improvement.plan.json", "utf8"),
));
assert.equal(plan.projectId, "esbiko");
assert.equal(plan.steps.length, 1);
assert.equal(plan.steps[0]?.executionMode, "reasoning");
assert.equal(plan.steps[0]?.recovery.enabled, true);
assert.equal(plan.steps[0]?.recovery.maxAttempts, 1);
assert.ok(plan.steps[0]?.allowedFunctions.includes("project.write"));
assert.deepEqual(
  plan.steps[0]?.verification.map(check => String(check.args.script)),
  ["build", "sim:check", "test:platform-api", "test:webmcp"],
);
assert.ok(plan.rules.some(rule => /Do not invent a failure/i.test(rule)));
assert.ok(plan.rules.some(rule => /Do not deploy/i.test(rule)));

console.log("Esbiko integration and mission contract tests passed.");
