# Chapter 06 - Runtime Orchestrator

## Purpose

The Runtime Orchestrator is responsible for deciding WHO should execute a job.

The Scheduler decides WHEN.
The Orchestrator decides WHO.

## Responsibilities

- Workflow coordination
- Driver selection
- AI selection
- Capability resolution
- Multi-agent coordination
- Dependency orchestration
- Result routing
- Failure recovery

## Workflow

KAP JOB
   ↓
Runtime Orchestrator
   ↓
Capability Resolver
   ↓
Driver Selection
   ↓
AI Selection
   ↓
Scheduler Dispatch
   ↓
Driver Execution
   ↓
Report Service

## Orchestrator Events

- orchestrator.started
- orchestrator.job.received
- orchestrator.driver.selected
- orchestrator.ai.selected
- orchestrator.workflow.started
- orchestrator.workflow.completed
- orchestrator.recovery.started
- orchestrator.recovery.completed

## Design Rules

1. Never execute jobs directly.
2. Never manipulate browser sessions.
3. Never own execution queues.
4. Make routing decisions only.
5. Publish all decisions through the Event Bus.

## Long-term Goal

The Runtime Orchestrator becomes the central coordination engine of KAOS, capable of routing work across multiple AI systems, multiple drivers and future distributed Runtime nodes.