import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProjectScanner } from "../ProjectScanner.js";

const root = mkdtempSync(join(tmpdir(), "keynu-graph-test-"));
mkdirSync(join(root, "src"));
mkdirSync(join(root, "node_modules"));
mkdirSync(join(root, "chrome-profile"));
writeFileSync(join(root, "src", "index.ts"), "export const ok = true;", "utf8");
writeFileSync(join(root, "node_modules", "ignored.js"), "ignored", "utf8");
writeFileSync(join(root, "chrome-profile", "profile.json"), "{}", "utf8");
writeFileSync(join(root, ".env.local"), "SECRET=test", "utf8");

try {
  const snapshot = new ProjectScanner(root).scan();
  assert.equal(snapshot.version, "1.0");
  assert(snapshot.nodes.some((node) => node.path === "src/index.ts"));
  assert(!snapshot.nodes.some((node) => node.path?.includes("node_modules")));
  assert(!snapshot.nodes.some((node) => node.path?.includes("chrome-profile")));
  assert(!snapshot.nodes.some((node) => node.path === ".env.local"));
  assert(snapshot.edges.some((edge) => edge.kind === "contains"));
  console.log("ProjectScanner tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
