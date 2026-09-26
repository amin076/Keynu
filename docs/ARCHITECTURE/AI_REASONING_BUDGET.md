# AI Reasoning Budget Architecture

Keynu separates **reasoning** from **execution** so expensive AI context is used only where judgment is needed.

## Principle

Do not send an entire repository to an AI agent for every step.

Keynu keeps mission memory, repository state, tool inventories, execution logs, and verification evidence locally. Deterministic work should be performed through Engineering Runtime, Integration Hub, MCP, APIs, scripts, Git, build/test, and verification.

An AI reasoning agent receives a small **Reasoning Brief** only when a decision is required.

```text
Developer goal
    |
    v
Keynu mission state
    |
    +--> deterministic next step? --> tools / MCP / API / scripts --> verify --> persist
    |
    +--> judgment required? -------> bounded Reasoning Brief --> AI
                                              |
                                              v
                                      small actionable plan
                                              |
                                              v
                                     Keynu executes/verifies
```

## Reasoning Brief

`ReasoningBriefBuilder` deliberately excludes memory-document bodies, package scripts, driver inventories, capability inventories, and unrelated repository content.

It contains only:

- mission identity, goal and current milestone;
- bounded changed-file names;
- last job/report state;
- bounded warnings and next actions;
- mission constraints;
- instructions that keep deterministic work in Keynu.

The default character budget is 8,000 characters. The builder records the estimated size and whether information was truncated.

Generate a brief after building Keynu:\n\n```bash\nnpm run build\nnpm run reasoning:brief -- <project-id>\n```\n\nOptional environment limits are `KEYNU_REASONING_MAX_CHARS`, `KEYNU_REASONING_MAX_CHANGED_FILES`, and `KEYNU_REASONING_MAX_NEXT_ACTIONS`.\n\nThis is not a claim about provider token or monetary cost. It is an enforceable Keynu-side context boundary.

## Bob 2.0 hackathon usage

For the IBM Bob 2.0 demo, Bob should be used as a targeted engineering reasoning component rather than as the executor of every deterministic operation. Keynu should perform and persist tool work, verification, evidence and continuation. A fresh Bob session can then receive a compact reasoning brief and continue from repository-backed mission state.

This makes the demo measurable:

- size of each reasoning brief;
- number of deterministic tool actions performed between reasoning requests;
- mission steps resumed without repository-wide rediscovery;
- verification outcomes and evidence produced.

Do not claim Bobcoin savings from these metrics unless measured in an actual Bob session.
