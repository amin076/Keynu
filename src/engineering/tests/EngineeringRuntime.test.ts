import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EngineeringDriver } from "../EngineeringDriver.js";
import { EngineeringRuntime } from "../EngineeringRuntime.js";

const root = await mkdtemp(join(tmpdir(), "keynu-engineering-runtime-"));
const runtime = new EngineeringRuntime();

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

try {
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
  git(["init"]);
  git(["config", "user.email", "keynu-tests@example.invalid"]);
  git(["config", "user.name", "Keynu Tests"]);
  git(["add", "package.json"]);
  git(["commit", "-m", "fixture"]);

  const write = await runtime.execute("fs.writeFile", {
    projectRoot: root,
    path: "src/example.txt",
    content: "hello engineering runtime",
  });
  assert.equal(write.success, true);
  assert.equal(await readFile(join(root, "src", "example.txt"), "utf8"), "hello engineering runtime");

  await assert.rejects(
    runtime.execute("fs.writeFile", {
      projectRoot: root,
      path: "../outside.txt",
      content: "blocked",
    }),
    /outside the approved workspace/i,
  );

  await assert.rejects(
    runtime.execute("fs.writeFile", {
      projectRoot: root,
      path: ".keynu/memory/current_state.md",
      content: "blocked",
    }),
    /PROTECTED_MEMORY_PATH/,
  );

  const command = await runtime.execute("command.run", {
    projectRoot: root,
    command: {
      command: process.execPath,
      args: ["-e", "console.log(process.cwd())"],
    },
  });
  assert.equal(command.success, true);
  assert.match(String((command.commandResults?.[0])?.stdout), /keynu-engineering-runtime-/i);

  await assert.rejects(
    runtime.execute("command.run", {
      projectRoot: root,
      command: { command: process.execPath, cwd: "..", args: ["-e", "console.log('no')"] },
    }),
    /outside the approved project root/i,
  );

  const script = await runtime.execute("script.run", {
    projectRoot: root,
    runtime: "node",
    script: "console.log('script-ok')",
  });
  assert.equal(script.success, true);
  assert.match(String(script.commandResults?.[0]?.stdout), /script-ok/);

  const status = await runtime.execute("git.status", { projectRoot: root });
  assert.equal(status.success, true);
  assert.match(JSON.stringify(status.data), /example\.txt/);

  const branch = await runtime.execute("git.createBranch", {
    projectRoot: root,
    branch: "feat/runtime-test",
  });
  assert.equal(branch.success, true);
  assert.equal(git(["branch", "--show-current"]), "feat/runtime-test");

  const stage = await runtime.execute("git.stage", {
    projectRoot: root,
    paths: ["src/example.txt"],
  });
  assert.equal(stage.success, true);

  const commit = await runtime.execute("git.commit", {
    projectRoot: root,
    message: "Add engineering fixture",
  });
  assert.equal(commit.success, true);
  assert.match(git(["log", "-1", "--pretty=%s"]), /Add engineering fixture/);

  const verify = await runtime.execute("project.verify", {
    projectRoot: root,
    commands: [
      { command: process.execPath, args: ["-e", "process.exit(0)"] },
      { command: process.execPath, args: ["-e", "console.log('verified')"] },
    ],
  });
  assert.equal(verify.success, true);
  assert.equal(verify.commandResults?.length, 2);

  const verifyFailure = await runtime.execute("project.verify", {
    projectRoot: root,
    commands: [
      { command: process.execPath, args: ["-e", "process.exit(5)"] },
      { command: process.execPath, args: ["-e", "throw new Error('must not run')"] },
    ],
  });
  assert.equal(verifyFailure.success, false);
  assert.equal(verifyFailure.commandResults?.length, 1);

  await assert.rejects(
    runtime.execute("command.run", {
      projectRoot: root,
      command: { command: "git", args: ["reset", "--hard", "HEAD"] },
    }),
    /blocks destructive Git command/i,
  );

  const driver = new EngineeringDriver(runtime);
  const driverStatus = await driver.execute({
    driver: "engineering",
    action: "git.currentBranch",
    payload: { projectRoot: root },
  });
  assert.equal(driverStatus.success, true);
  assert.match(JSON.stringify(driverStatus.data), /feat\/runtime-test/);

  console.log("Engineering Runtime tests passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
