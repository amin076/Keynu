# Keynu Script Command Runtime

Status: Implemented
Version: 1.0
Commit: 91ca028

## Purpose

The script command replaces oversized inline commands such as large Node.js `-e` payloads.

## Problems Solved

Large inline commands caused:

- quoting and escaping failures;
- command-length pressure;
- false safety matches;
- difficult debugging;
- unreadable reports;
- fragile shell behaviour;
- inconsistent Windows execution.

## Command Contract

```json
{
  "command": "script",
  "runtime": "node",
  "script": "console.log('hello')",
  "cleanup": true,
  "timeoutMs": 10000
}
```

Supported runtimes:

- node
- powershell
- python
- bash

## Lifecycle

1. Validate the runtime and script source.
2. Create a temporary file under `.keynu/runtime/scripts`.
3. Execute it through the existing CommandExecutor pipeline.
4. Capture output, errors, duration and exit status.
5. Remove the temporary file when cleanup is enabled.
6. Return the standard command result.

## Architecture Decision

CommandExecutor remains the single process-execution engine.

ScriptRunner owns only temporary-file creation and removal.

The implementation must not create a second execution pipeline.

## Verification

The compiled runtime passed a direct end-to-end test.

Verified behaviours:

- script execution;
- standard output capture;
- invalid runtime rejection;
- temporary-file cleanup;
- compiled executor integration.

## BrowserAgent Reload Requirement

A BrowserAgent process started before the build will continue using the previous compiled runtime.

After adding or rebuilding runtime features, BrowserAgent must be restarted before incoming KAP jobs can use those features.

## Migration Rule

Use direct command execution for small commands.

Use `command: script` for multiline logic, file generation, complex quoting, or large source payloads.

Large `node -e` commands are deprecated.

## Known Restart Lesson

Shell `start` commands are not reliable proof that a detached process launched successfully.

Restart verification should use observable evidence such as:

- process discovery;
- health endpoint;
- heartbeat file;
- log entry;
- BrowserAgent session update.
