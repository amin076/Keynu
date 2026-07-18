# Keynu Runtime Graph Intelligence

Status: Implemented foundation
Version: 0.1

## Purpose

Runtime Graph Intelligence combines the canonical knowledge graph with the active mission state to create a compact operational snapshot.

## Canonical Sources

- `.keynu/graph/snapshot.json`
- `.keynu/missions/state.json`

## Snapshot Contents

- active project and mission identifiers;
- mission status, milestone and last job;
- runtime state;
- node and edge totals;
- node and relationship counts by type;
- active nodes;
- recent edges;
- explicit warnings for missing or invalid files.

## Failure Policy

Missing or invalid files produce a valid empty snapshot with warnings instead of crashing Keynu.

## Next Integration

Expose this snapshot through the existing Graph HTTP API and Mission Dashboard.
