import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeFileSystemRequest } from "../filesystem-runtime-adapter.js";

const root = await mkdtemp(join(tmpdir(), "keynu-filesystem-test-"));

try {
  const write = await executeFileSystemRequest(root, {
    action: "writeFile",
    path: "nested/example.txt",
    content: "hello",
  });
  assert.deepEqual(write.changed, ["nested/example.txt"]);
  assert.equal(await readFile(join(root, "nested", "example.txt"), "utf8"), "hello");

  const read = await executeFileSystemRequest(root, {
    action: "readFile",
    path: "nested/example.txt",
  });
  assert.equal(read.data?.content, "hello");

  await assert.rejects(
    executeFileSystemRequest(root, {
      action: "writeFile",
      path: "../outside.txt",
      content: "no",
    }),
    /outside the approved workspace/i,
  );

  await assert.rejects(
    executeFileSystemRequest(root, {
      action: "writeFile",
      path: ".keynu/memory/knowledge.jsonl",
      content: "do not bypass protected memory",
    }),
    /PROTECTED_MEMORY_PATH/,
  );

  const exists = await executeFileSystemRequest(root, {
    action: "exists",
    path: "nested/example.txt",
  });
  assert.equal(exists.data?.exists, true);

  console.log("Filesystem runtime adapter tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
