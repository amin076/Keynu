# Chapter 05 - Runtime Scheduler

## Purpose

The Runtime Scheduler is responsible for deciding WHEN work should execute.

It never decides WHO executes the work. That responsibility belongs to the Runtime Orchestrator.

## Responsibilities

- Maintain the job queue
- Priority scheduling
- Dependency management
- Retry failed jobs
- Timeout handling
- Pause / Resume
- Cancel jobs
- Queue persistence
- Parallel execution coordination

## Job Lifecycle

NEW
  ↓
QUEUED
  ↓
READY
  ↓
RUNNING
  ↓
WAITING (optional)
  ↓
COMPLETED / FAILED / CANCELLED

## Scheduler Events

- scheduler.job.queued
- scheduler.job.ready
- scheduler.job.dispatched
- scheduler.job.waiting
- scheduler.job.resumed
- scheduler.job.retry
- scheduler.job.timeout
- scheduler.job.finished
- scheduler.queue.changed
- scheduler.queue.empty

## Design Rules

1. Scheduler owns execution order.
2. Scheduler never selects Drivers.
3. Scheduler never communicates with AI directly.
4. Scheduler publishes Events only.
5. Scheduler must survive Runtime restart.

## Long-term Goal

The Scheduler should evolve into a distributed scheduling engine capable of coordinating jobs across multiple Runtime nodes while preserving deterministic execution.