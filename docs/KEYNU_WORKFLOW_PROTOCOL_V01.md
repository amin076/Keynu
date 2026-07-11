# Keynu Workflow Protocol v0.1

## Purpose

Define how multiple jobs form a workflow, how workflows are scheduled, paused, resumed, switched, retried, and coordinated across multiple AI agents and applications.

## Core Concepts

- Workflow
- Stage
- Job
- SubJob
- Dependency
- Artifact
- Context
- Report

## Workflow States

- CREATED
- READY
- RUNNING
- PAUSED
- WAITING
- BLOCKED
- COMPLETED
- FAILED
- CANCELLED

## Job Relationships

- Sequential
- Parallel
- Conditional
- Dependency-based

## AI Rules

- AI must continue a workflow until it reaches a terminal workflow state.
- A blocked workflow does not stop the runtime.
- The scheduler may switch to another runnable workflow.

## Multi-Agent

A workflow may be executed collaboratively by ChatGPT, Codex, and other AI agents through Keynu.

## Persistence

Workflow state, artifacts, reports, and checkpoints must survive restart and reconnection.
