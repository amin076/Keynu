# Chapter 14 - ADR Index

## Purpose

Architecture Decision Records (ADRs) preserve the reasoning behind major architectural decisions in KAOS Runtime.

Every significant architectural change should be documented before implementation.

------------------------------------------------

## Current ADRs

ADR-0001 — Runtime Foundation
ADR-0002 — KAP Protocol
ADR-0003 — Browser Runtime
ADR-0004 — Persistent Job Store
ADR-0005 — Browser Watcher V2
ADR-0006 — Runtime Scheduler Foundation
ADR-0007 — Event-Driven Runtime
ADR-0008 — KAOS Runtime Architecture
ADR-0009 — Browser Agent Decomposition
ADR-0010 — Runtime Service Architecture
ADR-0011 — KAOS V3 Architecture Freeze

------------------------------------------------

## ADR Lifecycle

PROPOSED
   ↓
REVIEW
   ↓
ACCEPTED
   ↓
IMPLEMENTED
   ↓
SUPERSEDED (optional)

------------------------------------------------

## ADR Rules

1. Every major architectural decision requires an ADR.
2. Implementation should follow approved ADRs.
3. ADRs are immutable after acceptance.
4. Changes require a new ADR referencing the previous one.
5. ADR numbers are permanent and never reused.

------------------------------------------------

## Long-term Goal

The ADR collection should provide a complete architectural history of KAOS Runtime, allowing future developers and AI systems to understand not only what was built, but why each design decision was made.