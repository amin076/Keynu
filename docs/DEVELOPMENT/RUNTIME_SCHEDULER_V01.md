# Runtime Scheduler V01

## Status
Planned

## Goal

Build the central Scheduler of Keynu.

The Scheduler becomes the Runtime brain.
It decides WHAT runs, WHEN it runs, WHY it waits, and WHAT should execute next.

---

## Responsibilities

- Job Queue
- Priority Queue
- Dependency Graph
- Retry Policy
- Timeout Policy
- Pause / Resume
- Cancel
- Concurrent Jobs
- Delayed Jobs
- EventBus Integration

---

## Job Lifecycle

NEW
 ↓
QUEUED
 ↓
READY
 ↓
RUNNING
 ↓
WAITING
 ↓
RESUMED
 ↓
COMPLETED

or

FAILED

or

CANCELLED

---

## EventBus Integration

runtime.job.accepted
runtime.job.ready
runtime.job.started
runtime.job.waiting
runtime.job.resumed
runtime.job.completed
runtime.job.failed
runtime.job.cancelled
runtime.job.timeout

---

## Future

The Scheduler will coordinate ChatGPT, Codex, Claude, Gemini, Blender, Esbiko, YouTube and every future Driver.

This Scheduler becomes the execution core of KAOS.