import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPowerShellFileOps } from "../powershell-fileops.js";

const root = mkdtempSync(join(tmpdir(), "keynu-protected-fileops-"));
const memoryPath = ".keynu/memory/current_state.md";

try {
  const initial = await runPowerShellFileOps("protected-memory-initial", {
    target: "powershell",
    cwd: root,
    writeFiles: [{ path: memoryPath, content: "initial mission memory\n" }],
    includeGit: false,
  });
  assert.equal(initial.status, "COMPLETED");
  assert.equal(initial.writes[0]?.ok, true);

  const destructive = await runPowerShellFileOps("protected-memory-block", {
    target: "powershell",
    cwd: root,
    writeFiles: [{ path: memoryPath, content: "destructive replacement\n" }],
    includeGit: false,
  });
  assert.equal(destructive.status, "FAILED");
  assert.equal(destructive.writes[0]?.ok, false);
  assert.match(destructive.writes[0]?.error ?? "", /explicit authorization/i);
  assert.equal(
    readFileSync(join(root, memoryPath), "utf8"),
    "initial mission memory\n",
  );

  const appended = await runPowerShellFileOps("protected-memory-append", {
    target: "powershell",
    cwd: root,
    writeFiles: [
      {
        path: memoryPath,
        content: "verified checkpoint\n",
        operation: "append",
      },
    ],
    includeGit: false,
  });
  assert.equal(appended.status, "COMPLETED");
  assert.equal(appended.writes[0]?.ok, true);
  assert.equal(
    readFileSync(join(root, memoryPath), "utf8"),
    "initial mission memory\nverified checkpoint\n",
  );

  console.log("PASS ProtectedMemoryFileOpsIntegration");
} finally {
  rmSync(root, { recursive: true, force: true });
}
