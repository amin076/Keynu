# Keynu Codex Connector

Keynu already connects with ChatGPT through the browser agent flow:

1. ChatGPT sends a KAP job in a conversation.
2. `BrowserAgent` extracts the KAP envelope from the assistant message.
3. Keynu runs the job through its runtime and drivers.
4. Keynu sends a KAP report back to ChatGPT.

The Codex connector uses the same KAP idea, but Codex is different from a normal application driver.

Normal app integrations should receive strict KAP JSON because Keynu is asking them to perform deterministic operations. Codex is an AI coding agent, so the useful instruction sent to Codex should be clear natural English with project context, constraints, and expected output.

```txt
ChatGPT -> Keynu -> Codex -> Keynu -> ChatGPT
```

## Agent vs Driver

Inside Keynu, KAP remains the stable routing and tracking contract:

```txt
KAP JSON = job id, target, status, routing, report tracking
```

Between Keynu and Codex, Keynu prepares a coding-agent prompt:

```txt
Natural English prompt = task, context, constraints, expected result
```

This keeps Codex aligned with how coding agents work while preserving Keynu's KAP report lifecycle.

## Manual Bridge

1. Keynu receives a KAP job whose payload target is `codex`.
2. `CodexDriver` converts that job into a natural English Codex prompt.
3. Keynu writes the prompt to `.keynu/codex/prompts/<jobId>.md`.
4. Keynu writes a pending KAP report to `.keynu/codex/reports/<jobId>.pending.json`.
5. The user copies the generated prompt into Codex.
6. The user saves or pastes the Codex result back into Keynu.
7. Keynu converts that result into a completed KAP report.

No live Codex API connection exists yet.

## Files

```txt
src/drivers/codex/CodexDriver.ts
src/drivers/codex/codex.types.ts
src/drivers/codex/codex.jobMapper.ts
src/drivers/codex/codex.reportParser.ts
src/drivers/codex/cli.ts
examples/codex/codex-job.example.json
examples/codex/codex-hybrid-agent-job.example.json
docs/KEYNU_CODEX_CONNECTOR.md
```

## Prepare a Codex Prompt

Build Keynu first:

```powershell
npm run build
```

Then run:

```powershell
node dist/drivers/codex/cli.js prepare examples/codex/codex-job.example.json
```

Hybrid natural-language example:

```powershell
node dist/drivers/codex/cli.js prepare examples/codex/codex-hybrid-agent-job.example.json
```

This creates:

```txt
.keynu/codex/prompts/job-codex-keynu-connector-001.md
.keynu/codex/reports/job-codex-keynu-connector-001.pending.json
```

The generated prompt includes:

- Project name
- Local path
- GitHub repo
- KAP job id for tracking
- Current task
- Why Codex is an AI agent rather than a normal driver
- Existing Keynu ChatGPT browser-agent flow
- Files and areas Codex should avoid changing
- Expected output format

```txt
Changed files
Summary
Commands run
Any errors
How to test
Next recommended step
```

## Convert a Codex Result into a KAP Report

Save the Codex response to a Markdown file, then run:

```powershell
node dist/drivers/codex/cli.js complete job-codex-keynu-connector-001 path/to/codex-result.md .keynu/codex/reports/job-codex-keynu-connector-001.completed.json
```

The completed report is a standard KAP `REPORT` envelope with `payload.target` set to `codex` and `payload.status` set to `COMPLETED`.

## Job Shape

A Codex job is still a KAP `JOB` envelope, but the task can be natural English:

```json
{
  "protocol": "KAP",
  "version": "1.0",
  "type": "JOB",
  "id": "job-codex-keynu-connector-001",
  "createdAt": "2026-07-08T00:00:00.000Z",
  "payload": {
    "target": "codex",
    "projectName": "Keynu",
    "repo": "amin076/Keynu",
    "localPath": "C:\\Physics\\Keynu",
    "task": {
      "title": "Improve Keynu Codex Connector v0.2",
      "instructions": "Improve the connector as an AI-agent bridge. Keep KAP for routing and reports, but send Codex natural English task instructions.",
      "constraints": [
        "Keep the existing prepare command working.",
        "Do not add a live Codex API connection."
      ],
      "avoidChanging": [
        "src/drivers/dehlero/**",
        "src/drivers/youtube/**",
        "src/drivers/blender/**",
        "src/drivers/esbiko/**"
      ]
    }
  }
}
```

The outer JSON lets Keynu track `id`, `target`, status, and reports. The inner natural-language task lets Codex reason like a coding agent.

## Future API Bridge

The v0.1 transport is intentionally local and manual. A future Codex API connector can keep the same mapper and report parser, then replace the copy/paste step with a real request/response transport.
