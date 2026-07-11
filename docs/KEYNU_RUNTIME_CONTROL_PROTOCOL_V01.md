# Keynu Runtime Control Protocol v0.1

## Purpose

Define how Keynu handles job lifecycle, blocked work, connection loss, retries, user intervention, and switching between jobs.

## Job States

- RECEIVED
- VALIDATED
- QUEUED
- RUNNING
- PAUSED
- WAITING_FOR_USER
- WAITING_FOR_TARGET
- RETRYING
- BLOCKED
- COMPLETED
- FAILED
- CANCELLED
- INTERRUPTED

## Control Messages

- START_JOB
- PAUSE_JOB
- RESUME_JOB
- CANCEL_JOB
- SWITCH_JOB
- RETRY_JOB
- REQUEST_USER_ACTION
- CONNECTION_LOST
- CONNECTION_RESTORED

## Core Rules

1. A blocked job must not stop the entire Keynu runtime.
2. Keynu must persist blocked job state and continue another runnable job.
3. When a dependency becomes available, Keynu may resume the blocked job.
4. Completed jobs must never be executed again after reconnect or restart.

## Connection Rules

1. Pending jobs and reports must remain on disk if the browser connection is lost.
2. Keynu must request reconnection without losing job state.
3. Reports waiting in the outbox must be resent after reconnection without rerunning jobs.

## Execution Failure Rules

1. Retry only errors marked as retryable.
2. Invalid input, unsupported operation, permission errors, and syntax errors are not retried automatically.
3. Interrupted running jobs must be marked INTERRUPTED and reviewed according to retry policy.

## Report Rules

1. Reports are compact by default.
2. Full logs remain on disk.
3. Large output must be referenced using local artifact or log paths.

## Node-first Rule

Node.js is the primary Keynu runtime. PowerShell is used only for Windows-specific operations that cannot reasonably be performed with Node.js.
