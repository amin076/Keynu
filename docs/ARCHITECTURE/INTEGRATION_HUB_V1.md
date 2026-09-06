# Integration Hub v1

## Purpose

Integration Hub is Keynu's central application-registration and connection layer. It replaces the assumption that every external application needs its own Keynu Driver.

The core rule is:

> **A new application should not require new Keynu core code.**

## Architecture

```text
AI / KAP
   |
CapabilityRegistry
   |
Integration Hub compatibility bridge
   |
   +-- AppRegistry -------- config/integrations/*.json
   |
   +-- ConnectorRegistry
   |      +-- CLIConnector ---- Engineering Runtime
   |      +-- FileConnector --- Engineering Runtime
   |      +-- HTTPConnector --- manifest-governed HTTP/HTTPS
   |      +-- future: MCP / Browser / WebSocket
   |
   +-- optional Integration Packs
          +-- Melakat domain semantics
```

`Connector` means **how Keynu talks to an application**. `Integration Pack` means **what application-specific semantics Keynu must understand**.

## App manifests

App manifests use schema `keynu-app-manifest-0.1` and are discovered from `config/integrations/*.json` during IntegrationDriver initialization. Discovery is relative to the Keynu module/repository rather than the caller's current working directory, so `npm start` does not depend on being launched from one specific shell location.

Example:

```json
{
  "schemaVersion": "keynu-app-manifest-0.1",
  "id": "example",
  "name": "Example Tool",
  "projectId": "example",
  "rootEnv": "KEYNU_PROJECT_ROOT_EXAMPLE",
  "connectors": [
    {
      "id": "cli",
      "kind": "cli",
      "config": { "command": "example-tool" }
    }
  ],
  "capabilities": [
    {
      "name": "status",
      "risk": "execute",
      "connector": "cli",
      "request": { "args": ["status"] }
    }
  ]
}
```

No `ExampleDriver.ts` is required. The manifest is loaded, `example.status` is registered dynamically in `CapabilityRegistry`, and the shared CLI connector invokes the declared executable through Engineering Runtime.

## Capability routing

A manifest capability declares:

- `name` — app-local capability name;
- `risk` — `read`, `write`, or `execute`;
- `handler` — `connector` (default) or `pack`;
- `connector` — connector id when using generic connection mechanics;
- `request` — trusted static request configuration such as CLI args, HTTP path/method, or file operation.

The runtime-visible capability name is `<app-id>.<capability>`.

Example:

```text
melakat.runExperiment
        |
CapabilityRegistry
        |
integration driver (compatibility bridge)
        |
IntegrationHub.invoke("melakat", "runExperiment", input)
        |
Melakat Integration Pack
```

## Built-in connectors

### CLIConnector

- command comes from the trusted app manifest;
- static manifest args are combined with invocation args;
- execution is delegated to `EngineeringRuntime.command.run`;
- project-root confinement and destructive-command policy remain centralized in Engineering Runtime.

### FileConnector

Supports project-scoped:

- `readFile`
- `writeFile`
- `listDirectory`
- `exists`
- `createFolder`

All operations delegate to Engineering Runtime and therefore inherit workspace containment and protected-memory policy.

### HTTPConnector

HTTP applications can also register without a per-app Driver. The connector:

- accepts only manifest-declared `http`/`https` base URLs;
- requires a manifest-declared relative capability path and method;
- prevents invocation input from replacing the origin with an arbitrary URL;
- accepts invocation query/body data while keeping destination and static headers under trusted manifest control;
- treats only 2xx responses as successful.

This is suitable for application APIs that do not require special domain interpretation. Authentication/secret-provider policy is intentionally not invented in v1; secrets should not be embedded in manifests.

## Integration Packs

A pack is only needed when generic transport is not enough. It receives the resolved app manifest, capability, project root, and input.

Melakat requires domain semantics because a successful process exit is not enough for a research campaign: canonical `validation.json` evidence must also report success, and evidence-discovery operations must preserve scientific interpretation boundaries.

In v1, public `melakat.*` capabilities are registered from `config/integrations/melakat.json` and route through Integration Hub. The existing `MelakatDriver` remains registered for direct legacy commands and is reused internally by the Melakat pack as a compatibility implementation. A follow-up can move the semantic implementation into the pack/service and make the legacy driver a thin adapter.

## Discovery capabilities

Keynu exposes:

```text
integration.listApps
integration.describeApp
integration.listCapabilities
integration.invoke
```

These let AI/runtime components discover registered applications without inspecting Keynu source code.

## Migration policy

For an existing per-app Driver:

1. create a manifest;
2. move capability registration from hard-coded `registerBuiltinDrivers.ts` entries to the manifest;
3. route capabilities through Integration Hub;
4. use generic connectors wherever possible;
5. retain only domain semantics in an Integration Pack;
6. keep a legacy driver only while direct-driver compatibility is required.

Do not copy filesystem, shell, Git, build, test, process, or generic protocol logic into app packs.
