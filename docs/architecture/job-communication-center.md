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
  │ potentially silent for the entire job
  ▼
Final REPORT
  │ weak browser send confirmation
  ▼
ChatGPT
```

The original design had five operational gaps:

1. no immediate receipt acknowledgement;
2. no analyzed/started lifecycle record;
3. no per-step progress or long-running heartbeat;
4. report delivery was effectively one-shot and weak submission heuristics could confuse an unrelated DOM change with successful delivery;
5. no independent durable communication audit or startup recovery of persisted undelivered reports.

## Hardened architecture

```text
                         ┌──────────────────────────────────┐
ChatGPT ── KAP JOB ─────►│ BrowserAgent                     │
                         │ validate / claim                  │
                         └──────────────┬───────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────────┐
                         │ JobCommunicationCenter           │
                         │ durable lifecycle audit          │
                         │ non-blocking status queue        │
                         │ terminal report persistence      │
                         └──────────────┬───────────────────┘
                                        │
                              execution + progress callback
                                        ▼
                         ┌──────────────────────────────────┐
                         │ Executor / Driver                │
                         │ PowerShell / filesystem / runtime│
                         └──────────────┬───────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────────┐
                         │ ConversationManager              │
                         │ one global outbound lane         │
                         │ occupied-composer protection     │
                         │ strict DOM delivery proof        │
                         └──────────────┬───────────────────┘
                                        │
                        RECEIVED / HEARTBEAT / FAILURE / REPORT
                                        ▼
                                     ChatGPT
```

The main separation is:

```text
Execution != Reporting != Browser Transport != Audit
```

A slow or broken browser transport must not delay or change executor success.

## Lifecycle protocol

Keynu supports non-terminal `KAP JOB_STATUS` telemetry in addition to terminal `KAP REPORT`/`ERROR` messages.

Lifecycle stages:

- `RECEIVED` — Keynu accepted the KAP job.
- `ANALYZED` — the envelope was validated and the execution plan was accepted.
- `STARTED` — execution is beginning.
- `STEP_STARTED` — a driver operation began.
- `STEP_COMPLETED` — a driver operation completed successfully.
- `STEP_FAILED` — a driver operation failed.
- `STEP_SKIPPED` — fail-fast policy skipped an operation.
- `HEARTBEAT` — the job is still running.
- `STATUS_DELIVERED` — a non-terminal status was confirmed by the conversation transport.
- `STATUS_DELIVERY_FAILED` — non-terminal transport failed without failing execution.
- `REPORT_PERSISTED` — terminal report is durable before transport.
- `REPORT_DELIVERY_ATTEMPT` — delivery retry accounting.
- `REPORT_DELIVERED` — the browser conversation contains a new user-authored message matching the outbound report id/signature.
- `REPORT_DELIVERY_FAILED` — a terminal report delivery attempt failed confirmation.
- `COMPLETED` / `FAILED` — terminal execution state in the audit stream.

A `JOB_STATUS` message is telemetry only. It carries `requiresResponse: false` and instructs the receiving AI not to issue a replacement job before a terminal report/error.

## Chat-facing timing policy

Not every audited transition should create a ChatGPT turn. A live browser test showed that rapidly sending `RECEIVED`, `ANALYZED`, and `STARTED` into the same conversation creates unnecessary assistant traffic and can contend with the final report.

Default policy:

| Signal | Durable audit | Chat delivery |
| --- | --- | --- |
| `RECEIVED` | immediate | immediate |
| `ANALYZED` | immediate | throttled |
| `STARTED` | immediate | throttled |
| ordinary step transitions | immediate | throttled |
| `STEP_FAILED` | immediate | immediate eligibility |
| heartbeat | immediate when due | every 2 minutes while running |
| stall warning | immediate when due | after 5 minutes without a step transition |
| terminal report | persisted first | strictly confirmed with retries |

The ordinary minimum chat interval is 30 seconds. This keeps detailed lifecycle information in `.keynu/state/job-communications.jsonl` without forcing multiple rapid ChatGPT turns.

Non-terminal status delivery is queued asynchronously. `received()`, `analyzed()`, `started()`, and progress recording return after durable audit work rather than waiting for the browser composer. Terminal reports still wait for the serialized transport lane so message ordering remains deterministic.

## ConversationManager transport guarantees

All callers share one conversation-level outbound lane. Status, report, continuation, and reminder senders cannot type into the composer concurrently.

Before typing, `ConversationManager` reads the live composer and fails closed unless it can verify that the composer is empty. It never appends to or overwrites an existing user or stale Keynu draft.

Submission uses one consistent send-button selector set, including the current ChatGPT `aria-label="Send"` form, with keyboard submission only as a fallback.

Delivery confirmation is intentionally strict. Success requires a **new user-authored DOM message** whose text contains the outbound KAP id or derived message signature. The following are no longer sufficient proof by themselves:

- total message count increased;
- an assistant message appeared;
- the composer became empty;
- the send button changed busy/ready state.

If confirmation fails, Keynu only clears the draft when it can identify the remaining composer text as its own outbound message. It does not clear unrelated user text.

## Non-KAP assistant messages

Ordinary ChatGPT prose is not a protocol failure. Browser-origin ProviderRuntime calls translate responses with no valid KAP envelope into an internal `IGNORED` / `UNHANDLED` dispatch. `BrowserAgent` therefore records the message as handled and waits for the next assistant message without sending a recovery prompt.

This prevents the feedback loop:

```text
normal assistant prose
  -> automatic recovery prompt
  -> assistant response
  -> automatic recovery prompt
  -> ...
```

Generic non-browser `ProviderRuntime` callers keep their previous no-KAP behavior.

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
delivery attempt
   │
   ├─ no matching user DOM message -> failure accounting -> retry
   │
   └─ matching user DOM message -> mark delivered
                                      │
                                      ▼
                             mission continuation
```

A transport failure does not rewrite a successful execution as failed. The report remains persisted and can be delivered again.

At BrowserAgent startup, `recoverUndeliveredReports()` searches durable state and retries any terminal reports that were persisted but never marked delivered. Duplicate KAP jobs use the recovery path instead of re-running side effects.

## Driver integration

PowerShell and generic command routing expose progress callbacks. PowerShell reports transitions around:

- writes;
- reads;
- commands;
- builds;
- final Git state collection.

Filesystem routing reports start/completion/failure. Generic runtime results are translated into lifecycle step events as well.

Progress callback failures are isolated from executor success/failure so the reporting layer cannot accidentally break the actual job.

## Live-browser incident that drove hardening

During the 2026-09-07 smoke test, `job-keynu-read-project-memory-001` completed successfully, read all five requested memory files, passed verification, persisted its terminal report, and wrote `reportDeliveredAt`. The REPORT never appeared in ChatGPT.

The audit also showed that the actual filesystem read job took about 187 ms, while synchronous status transport in the older implementation introduced roughly 12 seconds before the first execution step. A recovery message was subsequently left unsent in the ChatGPT composer, and ordinary assistant prose triggered repeated recovery prompts.

These observations established three separate bugs: false-positive terminal delivery, transport/executor coupling, and a non-KAP recovery feedback loop.

## Regression coverage

The hardened tests cover:

- lifecycle audit and heartbeat;
- non-blocking status transport;
- chat telemetry throttling after initial receipt;
- terminal report persistence before transport;
- delivery retry and restart recovery;
- strict matching-user-message confirmation;
- rejection of unrelated message-count changes;
- occupied-composer protection;
- fail-closed composer inspection;
- Keynu-owned draft cleanup;
- global outbound serialization;
- ordinary and malformed browser prose safe-ignore behavior.

## Remaining live-browser verification

CI cannot fully reproduce a user's live ChatGPT DOM. After merge and local rebuild/restart, a live KAP smoke job must verify:

```text
JOB
 -> RECEIVED visible quickly
 -> execution begins immediately
 -> no recovery loop from ordinary assistant responses
 -> final REPORT appears as a real user-authored ChatGPT message
 -> processed-jobs.json records reportDeliveredAt only after that visible REPORT exists
```

Only after this live smoke passes should the browser reporting path be considered fully verified.
