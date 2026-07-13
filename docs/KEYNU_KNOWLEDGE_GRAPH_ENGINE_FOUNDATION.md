# Keynu Knowledge Graph Engine Foundation

## Goal

Create a visual architecture and runtime workflow graph for any connected application.

The graph must show:

- projects
- folders
- files
- modules
- services
- drivers
- runtime steps
- dependencies
- execution flow

When a job runs, involved nodes and edges must become active, pulse, flash, and record timing and status.

## Core Architecture

```text
Project Scanner
  -> Source Analyzer
  -> Graph Builder
  -> Graph Store
  -> Runtime Tracer
  -> Dashboard API
  -> Visual Graph UI
```

## Foundation Modules

### Project Scanner

Reads project structure while ignoring generated and dependency folders.

Initial supported inputs:

- Node.js projects
- TypeScript projects
- JavaScript projects
- Keynu itself

### Source Analyzer

Extracts imports and exports using lightweight static analysis.

Later adapters may use:

- TypeScript Compiler API
- Babel parser
- Python AST
- language server protocols

### Graph Builder

Produces normalized nodes and edges.

Node kinds:

- project
- folder
- file
- module
- function
- class
- service
- driver
- runtime-step

Edge kinds:

- contains
- imports
- exports
- calls
- depends-on
- executes
- reads
- writes
- reports-to

### Runtime Tracer

Receives runtime events and updates node state.

States:

- idle
- queued
- active
- success
- failed
- warning

### Graph Store

Initial implementation uses in-memory state plus JSON snapshots under:

```text
.keynu/graph/
```

Future implementation may use SQLite.

## Graph API

Planned endpoints:

```text
GET  /api/graph
POST /api/graph/scan
GET  /api/graph/events
POST /api/graph/events
```

## Dashboard

The first dashboard implementation should remain dependency-free and use the existing HTML dashboard.

React and React Flow can be introduced later after the graph schema, scanner, event protocol, and API are stable.

## Event Schema

```json
{
  "id": "event-001",
  "jobId": "job-001",
  "type": "node.active",
  "nodeId": "file:src/core/Runtime.ts",
  "time": "2026-07-13T00:00:00.000Z",
  "metadata": {
    "action": "execute"
  }
}
```

## Initial Milestones

1. Define graph types.
2. Build a safe project scanner.
3. Build import extraction for TypeScript and JavaScript.
4. Add graph snapshot generation.
5. Add graph API endpoint.
6. Add visual graph panel to the existing dashboard.
7. Connect runtime execution events.
8. Add active-node pulse and edge animation.
