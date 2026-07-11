# Runtime Orchestrator V01

## Purpose

The Scheduler decides WHEN a job should run.
The Orchestrator decides WHO should execute it.

The Orchestrator becomes the brain above the Scheduler.

---

## Responsibilities

- Receive Scheduler events
- Select Driver
- Select AI Agent
- Resolve dependencies
- Manage retries
- Coordinate parallel execution
- Route reports
- Handle failover

---

## Architecture

ChatGPT
Codex
Claude
Gemini
       │
       ▼
Runtime Orchestrator
       │
       ▼
Runtime Scheduler
       │
       ▼
Drivers

Browser
Filesystem
PowerShell
Blender
Esbiko
YouTube
...

---

## Event Pipeline

runtime.kap.received
→ scheduler.job.queued
→ scheduler.job.dispatched
→ orchestrator.driver.selected
→ driver.started
→ driver.completed
→ runtime.report.created
→ runtime.report.sent

---

## Long-term Goal

The Orchestrator becomes the central intelligence of KAOS, capable of coordinating multiple AI models and multiple applications simultaneously.