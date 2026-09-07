# Keynu Job Communication Center

## Purpose

Long-running KAP jobs must never become silent work from the AI's point of view. Execution, status communication, audit history, terminal report delivery, and continuation are separate responsibilities.

`JobCommunicationCenter` is the central lifecycle and delivery subsystem for KAP jobs. Drivers execute work; the communication center records and communicates what is happening.

## Before

```text
ChatGPT
  │ KAP JOB
  ▼
BrowserAgent
  │ claim + RUNNING
  ▼
Executor / Driver
  │
  │  potentially silent for the entire job
  │
  ▼
Final REPORT
  │ one browser send attempt
  ▼
ChatGPT
  │
  └─ continuation starts only after the report
```

This design had five operational gaps:

1. no immediate receipt acknowledgement;
2. no analyzed/started lifecycle messages;
3. no per-step progress or long-running heartbeat;
4. report delivery was effectively one-shot and delivery failure could be confused with execution failure;
5. no independent durable communication audit or startup recovery of persisted undelivered reports.

## After

```text
                         ┌──────────────────────────────────┐
ChatGPT ── KAP JOB ─────►│ JobCommunicationCenter           │
                         │ receive / analyze / lifecycle    │
                         │ durable audit / heartbeat        │
                         │ serialized outbound delivery     │
                         └──────────────┬───────────────────┘
                                        │
                              execution + progress callback
                                        ▼
                         ┌──────────────────────────────────┐
                         │ Executor / Driver                │
                         │ PowerShell / filesystem / runtime│
                         └──────────────┬───────────────────┘
                                        │ step events + result
                                        ▼
                         ┌──────────────────────────────────┐
                         │ JobCommunicationCenter           │
                         │ persist terminal report first    │
                         │ retry delivery / recover restart │
                         └──────────────┬───────────────────┘
                                        │
             RECEIVED / ANALYZED / STARTED / STEP / HEARTBEAT / REPORT
                                        ▼
                                     ChatGPT
                                        │
                                        ▼
                               Mission continuation
```

## Lifecycle protocol

Keynu now supports non-terminal `KAP JOB_STATUS` telemetry in addition to the existing terminal `KAP REPORT`/`ERROR` contract.

Lifecycle stages:

- `RECEIVED` — Keynu has accepted the KAP job.
- `ANALYZED` — the envelope was validated and the execution plan was accepted.
- `STARTED` — side-effecting execution is beginning.
- `STEP_STARTED` — a driver operation has begun.
- `STEP_COMPLETED` — a driver operation completed successfully.
- `STEP_FAILED` — a driver operation failed.
- `STEP_SKIPPED` — fail-fast policy skipped an operation.
- `HEARTBEAT` — the job is still running.
- `STATUS_DELIVERED` — a non-terminal status submission succeeded.
- `STATUS_DELIVERY_FAILED` — a non-terminal status submission failed without failing execution.
- `REPORT_PERSISTED` — terminal report is durable before transport.
- `REPORT_DELIVERY_ATTEMPT` — delivery retry accounting.
- `REPORT_DELIVERED` — browser submission layer confirmed report submission.
- `REPORT_DELIVERY_FAILED` — a terminal report delivery attempt failed.
- `COMPLETED` / `FAILED` — terminal execution state in the audit stream.

A `JOB_STATUS` message is telemetry only. It carries `requiresResponse: false` and instructs the receiving AI not to issue a replacement job before a terminal report/error.

## Timing policy

Default policy:

| Signal | Default |
| --- | --- |
| `RECEIVED` | immediate |
| `ANALYZED` | immediate |
| `STARTED` | immediate |
| step events | always audited; chat delivery throttled to avoid noise |
| ordinary status minimum chat interval | 30 seconds |
| heartbeat | every 2 minutes |
| stall warning | after 5 minutes without a step transition |
| terminal report delivery attempts | 5 |
| terminal retry delays | 1s, 3s, 10s, 30s |

Failures are not hidden by throttling. A `STEP_FAILED` status is eligible for immediate delivery.

All outbound lifecycle and terminal messages pass through one serialized communication lane. This prevents a heartbeat, step transition, and final report from trying to use the browser composer concurrently. Serialization is transport coordination only; executor work and the durable audit remain independent.

## Durable state

Two independent durable records are used:

- `.keynu/state/processed-jobs.json` — job terminal state, persisted report body, delivery attempts, last delivery error, delivered timestamp.
- `.keynu/state/job-communications.jsonl` — append-only lifecycle/audit events.

The communication audit is intentionally separate from execution artifacts. A job can succeed even if a non-terminal status message cannot be delivered.

## Terminal report guarantee

The terminal path is:

```text
execution result
   │
   ▼
verification
   │
   ▼
persist REPORT
   │
   ▼
delivery attempt ──failed──► retry accounting ──► retry
   │ success
   ▼
mark delivered
   │
   ▼
mission continuation
```

A transport failure does not rewrite a successful execution as a failed execution. The report remains persisted and can be delivered again.

At BrowserAgent startup, `recoverUndeliveredReports()` searches durable state and retries any terminal reports that were persisted but never marked delivered. Duplicate KAP jobs also use this recovery path instead of re-running side effects.

## Driver integration

PowerShell and generic command routing expose progress callbacks. PowerShell reports transitions around:

- writes;
- reads;
- commands;
- builds;
- final Git state collection.

Filesystem routing reports start/completion/failure. Generic runtime results are translated into lifecycle step events as well.

Progress callback failures are isolated from executor success/failure so the reporting layer cannot accidentally break the actual job.

## Verification

The communication-center tests cover:

- lifecycle status emission;
- serialized status/report transport;
- periodic heartbeat;
- terminal report persistence before transport;
- multiple failed delivery attempts followed by recovery;
- restart recovery of an undelivered persisted report.

## Remaining live-browser verification

CI can verify compilation, lifecycle state, retry persistence, driver progress callbacks, and integration contracts. It cannot fully reproduce a user's live ChatGPT browser session. After merge/deployment, a live KAP smoke job should confirm that the browser conversation visibly receives `RECEIVED`, `ANALYZED`, `STARTED`, periodic heartbeat/status, and the final terminal report in the expected order.
