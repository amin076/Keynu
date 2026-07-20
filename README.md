# Keynu

> A mission operating system for AI agents.

Keynu helps AI systems continue long-running missions across conversations, restore repository-backed context, execute local tools through controlled drivers, and verify completed work with concrete evidence.

## Why Keynu

AI assistants are effective at isolated prompts, but complex projects frequently lose context, stop between conversations, disconnect reasoning from local execution, or claim completion without verifiable proof.

Keynu addresses this by placing a mission-oriented runtime between AI providers and local applications.

## Core Capabilities

- repository-backed mission memory;
- mission bootstrap and acknowledgement;
- structured KAP jobs, reports, errors, and control messages;
- controlled local execution through registered drivers;
- provider-neutral runtime foundations;
- automatic continuation after completed or interrupted steps;
- verification checks and evidence certificates;
- Mission Control visibility into runtime, mission, and graph state.

## Build Week Demo

The competition demo follows one continuous mission across the AI and local runtime:

```text
New Chat
  -> Mission Bootstrap
  -> Mission Acknowledgement
  -> Structured KAP Job
  -> Local Keynu Execution
  -> Verified KAP Report
  -> Evidence Certificate
  -> Continuation Request
  -> Next Distinct Mission Step
  -> Mission Control Evidence
```

The central idea is simple:

> AI agents should not merely answer prompts. They should continue missions safely, remember project state, use real tools, and prove what they accomplished.

## Architecture

```text
ChatGPT / Codex / Human / Dashboard
                 |
                 v
          Provider Runtime
                 |
                 v
      Mission + Memory Runtime
                 |
                 v
          KAP Command Layer
                 |
                 v
      Drivers and Local Tools
                 |
                 v
 Verification + Evidence Store
                 |
                 v
        Mission Control UI
```

## Important Components

- `MissionRegistry` and `ActiveMissionResolver`;
- `MissionManager` and `MissionStateMachine`;
- `BootstrapBuilder`;
- `BrowserContinuationCoordinator`;
- `ContinuationStore` and `ContinuationDeliveryService`;
- `ProviderRuntime`;
- KAP extraction, validation, interpretation, and routing;
- driver and capability registries;
- verification policies and certificates;
- BrowserAgent;
- Mission Control Dashboard.

## Run Locally

### Requirements

- Node.js 20 or later;
- npm;
- Google Chrome for BrowserAgent operation.

### Install and Build

```powershell
npm install
npm run build
```

### Run Verification Tests

```powershell
npm run test:verification
```

### Connect ChatGPT

```powershell
npm run connect:chatgpt
```

Follow the terminal instructions, open the requested ChatGPT conversation in the dedicated Keynu Chrome window, and leave the connector terminal running.

### Start BrowserAgent Directly

```powershell
npm run browser-agent
```

### Check Mission Control

```powershell
npm run dashboard:health
npm run dashboard:status
```

## Verification Philosophy

Keynu does not treat a successful process exit as sufficient proof of completion. Runtime results can be checked against execution evidence, repository state, read-back operations, and verification policies. Successful verified operations may produce evidence certificates.

## OpenAI Build Week

The Build Week milestone is to deliver a focused, competition-ready demonstration of persistent mission continuity, safe local action, and evidence-backed completion.

Development priorities before submission:

1. confirm the exact Codex execution path and meaningful Codex contribution;
2. validate the complete demo sequence;
3. ensure Mission Control clearly presents mission and evidence state;
4. record the demo video;
5. complete final build, test, and submission checks.

## Project Status

The repository currently contains working mission, continuation, BrowserAgent, provider, KAP, driver, verification, and Mission Control foundations. Build and verification tests have passed during the Build Week preparation process.

## License

License information will be added before public submission.
