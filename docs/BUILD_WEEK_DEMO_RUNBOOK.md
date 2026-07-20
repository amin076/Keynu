# Keynu OpenAI Build Week Demo Runbook

## Goal

Demonstrate that Keynu can recover an active mission, connect an AI conversation to real local tools, verify the result, and continue with a distinct next step instead of silently stopping.

## Target Duration

3–5 minutes.

## Demo Success Criteria

The final recording must visibly show:

1. the active Build Week mission;
2. a `MISSION_BOOTSTRAP`;
3. a valid `MISSION_ACK`;
4. a structured `KAP JOB`;
5. real local execution;
6. a verified `KAP REPORT`;
7. verification or certificate evidence;
8. a `KEYNU_CONTINUATION_REQUEST`;
9. a distinct follow-up step;
10. relevant Mission Control evidence.

## Preflight

From `C:\Physics\Keynu` run:

```powershell
git branch --show-current
git status --short
npm run build
npm run test:verification
npm run dashboard:health
npm run dashboard:status
```

Confirm that:

- the build succeeds;
- verification tests pass;
- the intended mission is active;
- unrelated working-tree changes are understood and preserved;
- Mission Control is reachable.

## Connect ChatGPT

Run:

```powershell
npm run connect:chatgpt
```

Then:

1. use the dedicated Keynu Chrome window;
2. open the intended ChatGPT conversation;
3. paste its URL when requested;
4. leave the connector terminal running;
5. avoid running two BrowserAgent processes against the same conversation.

Direct BrowserAgent startup is available through:

```powershell
npm run browser-agent
```

## Recording Sequence

### Scene 1 — Explain the problem

Show Mission Control or the repository and say:

> Normal AI conversations lose operational continuity. Keynu preserves the mission, connects reasoning to local tools, and verifies what actually happened.

### Scene 2 — Recover the mission

Show a `MISSION_BOOTSTRAP` containing:

- mission ID;
- active milestone;
- repository memory revision;
- acknowledgement requirement.

Return a valid `MISSION_ACK`.

Explain that the new conversation recovered the existing project mission instead of starting from zero.

### Scene 3 — Execute a safe KAP job

Use a tiny deterministic demo artifact such as:

```text
.keynu/demo/build-week-proof.txt
```

Suggested content:

```text
Keynu Build Week proof
Mission: openai-build-week
Purpose: verified local execution and continuation
```

The KAP job should:

1. use a globally unique job ID;
2. create or update only the dedicated demo artifact;
3. read the result back;
4. inspect Git state;
5. return bounded browser evidence;
6. preserve the complete report.

### Scene 4 — Show verification

Highlight in the resulting `KAP REPORT`:

- job status;
- driver operation;
- read-back evidence;
- Git-state evidence;
- verification result;
- certificate ID when available.

Explain that Keynu does not treat a successful exit code alone as proof of completion.

### Scene 5 — Continue autonomously

Show the generated `KEYNU_CONTINUATION_REQUEST`.

Highlight:

- previous job ID;
- resume token;
- requirement to choose a distinct step;
- instruction not to silently stop.

Return a second read-only KAP job that validates or summarizes the demo artifact. Do not repeat the original write operation.

### Scene 6 — Show Mission Control

Display the clearest available views of:

- active mission;
- recent KAP execution;
- verification status;
- continuation status;
- runtime graph;
- persisted report evidence.

Use only working and understandable panels.

### Scene 7 — Closing statement

End with:

> Keynu turns an AI conversation into a persistent, tool-using, evidence-backed mission runtime.

## Failure Recovery

### Duplicate job detected

- never reuse a previous job ID;
- do not resend a completed write operation;
- issue a new, distinct mission step.

### No report returned

Inspect BrowserAgent logs for:

- KAP extraction;
- envelope acceptance;
- execution start;
- duplicate suppression;
- browser submission confirmation;
- connection errors.

### Browser debugging connection fails

Reconnect using:

```powershell
npm run connect:chatgpt
```

Confirm the dedicated Chrome instance is running with remote debugging on port `9222`.

### Codex command unavailable

Do not claim direct Codex CLI integration until the executable path is verified. Document Codex-assisted repository work separately.

### Verification failure

Show the failed evidence check, correct only the relevant payload or environment issue, and rerun using a new job ID.

## Final Rehearsal Checklist

- build passes;
- verification passes;
- Mission Control is reachable;
- each KAP message has a unique ID;
- the demonstration artifact path is safe;
- no secrets or personal data appear;
- the complete flow works twice consecutively;
- full reports and certificate IDs are preserved;
- Build Week commits and Codex contributions are identifiable.
