# BrowserAgent Autonomous Continuation

Status: Integrated
Version: 0.1

## Purpose

BrowserAgent now connects verified KAP report delivery to the Mission Continuation Engine.

After a report is delivered, BrowserAgent evaluates the active mission and asks the AI for the next safe KAP job when no user decision is required.

## Runtime Flow

1. Execute the KAP job.
2. Build and verify the report.
3. Send the verified report to the active conversation.
4. Record the completed job in MissionManager.
5. Read the active mission context.
6. Persist a `WAITING_AI` continuation record.
7. Reserve a deterministic continuation request identifier.
8. Send the continuation request through the active conversation.
9. Mark delivery as successful or failed.
10. Suppress duplicate requests for the same mission, job, and next action.

## Failure Isolation

Continuation delivery is wrapped independently from report delivery.

A continuation error must not change a successfully executed KAP report into a failed report.

## Autonomous Limits

The coordinator enforces a maximum autonomous-step count. When the limit is reached, no further AI continuation request is sent until a human or runtime policy explicitly resumes the mission.

## Required AI Behaviour

After receiving `KEYNU_CONTINUATION_REQUEST`, the AI must return one of the following:

- the next valid and verifiable KAP job;
- `WAITING_USER` with a specific required decision;
- `WAITING_EXTERNAL_SYSTEM` with the dependency identified;
- `BLOCKED` with a concrete reason;
- `COMPLETED`; or
- `FAILED`.

The AI must not silently stop while a safe next KAP job is available.
