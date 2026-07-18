# Keynu AI Continuation Request

Status: Implemented foundation
Version: 0.1

## Purpose

After a verified job, Keynu must not become silently idle while an active mission has a safe next step.

The continuation request asks the AI for either the next valid KAP job or an explicit waiting, blocked, completed, or failed decision.

## Deduplication

A deterministic resume token is generated from the mission identifier, previous job identifier, and next action.

The same continuation state therefore produces the same request identifier.

## Send Rules

The request is allowed only when the mission is incomplete, the next-action owner is the AI, the decision is WAITING_AI or CONTINUE, and the autonomous step limit has not been reached.

## Required AI Response

The AI must return either:

- the next safe and verifiable KAP job; or
- WAITING_USER, WAITING_EXTERNAL_SYSTEM, BLOCKED, COMPLETED, or FAILED with an explicit reason.

BrowserAgent must persist the request identifier before sending it so duplicate requests are prevented.
