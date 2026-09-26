# Mission Impact Report

Keynu can turn persisted mission state and execution evidence into a compact, demo-ready impact report.

After a mission has run:

```bash
npm run mission -- report <config.json> <plan-id>
```

For machine-readable output:

```bash
npm run mission -- report <config.json> <plan-id> --json
```

The report is derived from the existing plan store and evidence files. It does not ask an AI model to summarize the run.

It reports:

- final mission status and completed/blocked/pending steps;
- persistent AI call count;
- reasoning-gate bypasses and reasoning-required steps;
- observed function and verification actions;
- actions per AI call;
- escalation packet count and serialized size;
- recovery attempts and successful recoveries;
- evidence record count and observed time range.

## Demo interpretation

The useful hackathon story is not “Keynu saved X Bobcoins” unless a real Bob session measured X. The report instead proves what Keynu itself observed: how much deterministic work occurred, where reasoning was bypassed, whether a failure was narrowed to a bounded packet, whether recovery succeeded, and whether completion was verified.

This report is intended to be captured alongside real Bob session evidence later, so provider usage and Keynu runtime behavior remain clearly separated.
