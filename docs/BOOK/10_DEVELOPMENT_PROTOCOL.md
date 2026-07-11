# Chapter 10 - Development Protocol

## Purpose

This chapter defines the mandatory development rules for every AI working on the KAOS Runtime.

These rules are Runtime rules, not ChatGPT-specific behavior.

## Development Rules

1. Always use standard KAP envelopes.
2. Always use protocol version 1.0 unless officially upgraded.
3. One responsibility per JOB.
4. Keep JOBs small and independently executable.
5. Every implementation must build successfully before completion.
6. Runtime architecture changes require an ADR.
7. After a COMPLETED REPORT, automatically continue with the next logical implementation task.
8. Stop only when:
   - Human decision is required.
   - Manual intervention is required.
   - An unrecoverable error prevents progress.
9. Prefer implementation over documentation after the Architecture Freeze.
10. Runtime state must remain restart-safe.

## Meaning of 'W'

Within KAOS development:

W = Wake up.

Behavior:

- Analyze current project state.
- Select the next logical task.
- Generate the next KAP JOB.
- Do not wait for additional user instructions unless blocked.

## AI Contract

Every AI connected to KAOS must follow these rules consistently.

The behavior must remain identical regardless of whether the connected AI is ChatGPT, Codex, Claude, Gemini or another future model.

## Long-term Goal

Development becomes autonomous, deterministic and restart-safe, allowing any supported AI to continue the project from the current Runtime state with minimal human guidance.