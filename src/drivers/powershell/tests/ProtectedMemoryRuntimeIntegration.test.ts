import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256Text } from "../../../memory/ProtectedMemoryPolicy.js";
import { writePowerShellFile } from "../powershell-runner.js";

const root = mkdtempSync(join(tmpdir(), "keynu-protected-memory-"));

try {
  const relativePath = ".keynu/memory/current_state.md";

  const initial = writePowerShellFile(root, {
    path: relativePath,
    content: "initial memory\n",
  });
  assert.equal(initial.ok, true);

  const blockedReplace = writePowerShellFile(root, {
    path: relativePath,
    content: "destructive replacement\n",
  });
  assert.equal(blockedReplace.ok, false);
  assert.match(blockedReplace.error ?? "", /explicit authorization/i);

  const appended = writePowerShellFile(root, {
    path: relativePath,
    content: "verified checkpoint\n",
    mode: "append",
  });
  assert.equal(appended.ok, true);
  assert.equal(
    readFileSync(join(root, relativePath), "utf8"),
    "initial memory\nverified checkpoint\n",
  );

  const staleConflict = writePowerShellFile(root, {
    path: relativePath,
    content: "stale append\n",
    mode: "append",
    expectedSha256: sha256Text("stale content"),
  });
  assert.equal(staleConflict.ok, false);
  assert.match(staleConflict.error ?? "", /SHA-256/i);

  const current = readFileSync(join(root, relativePath), "utf8");
  const authorizedReplace = writePowerShellFile(root, {
    path: relativePath,
    content: "authorized replacement\n",
    mode: "replace",
    allowProtectedReplace: true,
    expectedSha256: sha256Text(current),
  });
  assert.equal(authorizedReplace.ok, true);
  assert.equal(
    readFileSync(join(root, relativePath), "utf8"),
    "authorized replacement\n",
  );

  const ordinaryPath = "src/example.txt";
  const ordinaryInitial = writePowerShellFile(root, {
    path: ordinaryPath,
    content: "old",
  });
  assert.equal(ordinaryInitial.ok, true);

  const ordinaryReplace = writePowerShellFile(root, {
    path: ordinaryPath,
    content: "new",
  });
  assert.equal(ordinaryReplace.ok, true);
  assert.equal(readFileSync(join(root, ordinaryPath), "utf8"), "new");
  assert.equal(existsSync(join(root, ordinaryPath)), true);

  console.log("PASS ProtectedMemoryRuntimeIntegration");
} finally {
  rmSync(root, { recursive: true, force: true });
}
