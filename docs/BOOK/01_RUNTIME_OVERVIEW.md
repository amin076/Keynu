# Chapter 01 - Runtime Overview

## What is KAOS?

KAOS (Keynu AI Operating System) is an event-driven AI Runtime that coordinates AI models, drivers, applications and future distributed nodes.

Its responsibility is orchestration rather than intelligence.

## Core Components

- Event Bus
- Runtime Services
- Scheduler
- Orchestrator
- Driver Registry
- Runtime Memory
- AI Connectors
- Dashboard

## Runtime Flow

User
↓
AI
↓
KAP JOB
↓
Runtime
↓
Scheduler
↓
Orchestrator
↓
Driver
↓
Application
↓
KAP REPORT
↓
AI

## Design Principles

1. Event-first architecture.
2. Small independent services.
3. Drivers are replaceable.
4. AI models are replaceable.
5. Runtime owns the workflow.
6. Every important action emits an event.
7. Runtime survives restart.
8. Architecture is documented through ADRs.

## Purpose

The Runtime is designed to become a universal operating layer capable of connecting multiple AI systems with multiple applications through standardized protocols.