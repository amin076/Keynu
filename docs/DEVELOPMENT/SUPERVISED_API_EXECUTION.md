# Supervised API execution / اجرای مأموریت با API

## What is implemented

- Outbound OpenAI Responses execution with a fresh worker request per action and a separate reviewer request.
- Authenticated local HTTP API for plan submission, status, run and explicit resume.
- Named functions with Zod input schemas; trusted Node.js / Windows PowerShell scripts receive JSON arguments.
- Goals, ordered dependency steps, immutable evidence, review results and future proposals persist on disk.
- One to four concurrent workers on different project roots; the same root runs serially.
- Persistent call budgets, mandatory checks, fail-closed review, interruption detection and explicit recovery.
- Reads existing `.keynu/memory` documents without overwriting protected mission memory.

This is an opt-in CLI/API composition. Mission Control's Missions page displays these
plans from the configured local state store. It is not already running on your Windows machine.

## Quick start (repository root, PowerShell)

```powershell
npm ci
npm run build
npm run mission -- add examples/execution/config.json examples/execution/keynu-audit.plan.json
npm run mission -- status examples/execution/config.json
```

Set `OPENAI_API_KEY` privately in the local process environment and `OPENAI_MODEL` to a
model available to your API account. Do not paste keys into chat, plans or Git.
`OPENAI_REVIEW_MODEL` optionally chooses a different reviewer model.
`OPENAI_BASE_URL`, if used, must be the full Responses endpoint, not just `/v1`.

```powershell
npm run mission -- run examples/execution/config.json
```

`run` drains currently ready work. `watch` checks every five seconds for newly queued
plans and stays alive while the terminal/process is running:

```powershell
npm run mission -- watch examples/execution/config.json
```

It does not invent endless work, bypass quota or survive a powered-off machine. For daily
operation, keep the worker on an always-on machine and arrange OS service startup. Bounded
interval recurrence is supported below. OS service installation and calendar/cron scheduling
are not implemented in this change.

## Local inbound API

Set `KEYNU_API_TOKEN` to a strong random secret of at least 32 characters. Then:

```powershell
npm run mission -- serve examples/execution/config.json
```

Default address: `http://127.0.0.1:4788`. Optional `KEYNU_API_PORT` changes the port.
Every request needs `Authorization: Bearer <token>`; POST JSON uses `Content-Type: application/json`.

| Route | Effect |
| --- | --- |
| GET /health | Worker running flag and last scheduling error |
| GET /plans | Goals, stages, budgets, outcomes and proposals |
| POST /plans | Add a validated plan; project and capabilities must match apiProjects |
| POST /run | Start draining ready work; 409 if already running |
| POST /resume | `{ "planId": "...", "stepId": "..." }`; no budget reset |

Example local request (the token stays in the process environment):

```powershell
$headers = @{ Authorization = "Bearer $env:KEYNU_API_TOKEN" }
Invoke-RestMethod -Uri http://127.0.0.1:4788/plans -Headers $headers
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4788/run -Headers $headers
```

The HTTP server polls automatically only with `autoRun: true`; otherwise invoke `/run`
after adding plans. Do not run
`serve` and `watch` as competing owners of the same store. This loopback endpoint cannot
be reached directly by a cloud ChatGPT session; a separately designed connector is needed.

## Named functions

Built-ins: `project.list`, `project.read`, `project.write`, `git.status`.
The worker can invoke only names approved for its current step. For example:

```json
{"kind":"call","name":"project.read","args":{"path":"README.md"}}
```

`project.write` requires the SHA256 returned by `project.read` for an existing file,
or null for a new file. Path traversal, symlinks, `.git`, `.keynu`, `node_modules` and
common dotfile credential locations are rejected. This protects against accidental
escape; it does not isolate a malicious process racing the filesystem.

Trusted custom script definitions in config specify name, description, runtime, script
path, timeout and primitive typed fields. Unknown fields/incorrect types are rejected.
The model never sends script source. Scripts receive the temporary JSON-file path as
argument 1. Examples for both Node and PowerShell are under `examples/execution`.
Script hashes are checked before execution; reloading configuration approves new script content.
Only trusted scripts should be registered. External script changes and spawned descendants
remain OS-level concerns; use worktrees and least-privileged service accounts for deployment.

## Audit → development → verification

Create one plan with steps such as `audit`, `implement` depending on `audit`, then
`validate` depending on `implement`. Put concrete acceptance criteria into each goal and
register project-specific checks. Give `project.write` only to stages that need edits.
For Esbiko/ClaimFlow use the repository's actual npm checks. For ملاکت/Dishmook register
trusted Node wrappers around the actual Python tests; do not assume npm applies to them.
Separate projects can run concurrently by setting concurrency to 3 or 4 and adding plans
with different canonical roots. Do not use nested project roots as independent projects.

The audit's decisions and results are in `<stateDirectory>/evidence/<planId>/` and later
steps receive recent evidence plus persisted summaries from previous plans for that project.
The context window is bounded and excerpts are marked truncated; full evidence remains on
disk. Huge histories need future retrieval/indexing work, not claims of unlimited memory.

## Failure and resume

A failed function, failed check, rejected/malformed AI response, authentication/quota error
or exhausted budget blocks the step; dependents remain pending. The persisted continuation
states who owns the next action. Inspect state and evidence before:

```powershell
npm run mission -- resume examples/execution/config.json PLAN_ID STEP_ID
npm run mission -- run examples/execution/config.json
```

A hard-killed worker may leave `.lock` directories next to plans.json, runner or project
`.keynu/state/mission-execution`. Confirm all owners have stopped before removing only
those stale directories. Restart marks unfinished RUNNING steps INTERRUPTED. Reconcile
intent/result evidence and any actual filesystem changes before resuming. Never blindly
replay an ambiguous operation. Completed stages and call budgets survive restarts.

A fresh request reconstructs context; it does not depend on chat memory. However, model
review can be wrong. Keep actual builds/tests and measurable scientific acceptance
criteria as the basis for approving progress.

## Follow-up: monitoring, ownership and scheduled work

See ADR-0015 and the supervision follow-up audit for the ownership and scheduling contracts.

- Open **Missions** in Mission Control to see supervised plans and their execution phases.
  Default store is `.keynu/execution` relative to the Keynu process working directory.
  Set `KEYNU_EXECUTION_STATE_DIR` for a custom store. This dashboard view is read-only.
- `npm run mission -- monitor examples/execution/config.json` needs no API key and shows
  readiness, dependency blockers, budgets, heartbeat age and last-progress age.
- `GET /monitor` provides the same observation through the authenticated local API.
- `POST /stop` persists a pause and requests stopping between actions. It is not immediate
  process-tree termination. `POST /run` or explicit CLI `run` clears the pause; `watch`
  and automatic server polling respect it after restart.
- Add `"autoRun": true` to trusted server config to poll ready plans every five seconds.
  Run only one scheduler/server per plan store.
- Add a UTC `notBefore` timestamp to delay a plan. Add
  `"recurrence": {"intervalMs": 86400000, "maxRuns": 7}` for up to seven daily occurrences,
  including the first. The next occurrence is saved only after all current steps succeed.
  Each occurrence has fresh per-step budgets: total possible consumption is multiplied
  by maxRuns. No catch-up burst or OS service installation is performed.
- Each step defaults to `"reviewEveryActions": 3`. Intermediate reviews consume requests
  from maxAiCalls and can stop drift. Set 0 only to disable intermediate checks; final
  checks/review remain mandatory. Size the budget to include these reviews.
- Browser/API operations routed through the shared command/filesystem/PowerShell adapters
  serialize on the same Git checkout, including its subdirectories. Conflicts time out
  after five seconds. External drivers/editors remain outside the lock; use separate
  worktrees when separate AIs pursue different goals.

`examples/execution/keynu-daily-audit.plan.json` demonstrates a finite recurring audit.
It is an example, not a plan installed or started automatically by this change.
