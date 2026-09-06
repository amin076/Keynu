# Chapter 07 - Application Integration and Driver Compatibility

## Purpose

Keynu connects to external applications through the **Integration Hub**. Per-application Drivers are no longer the preferred extension model.

The architectural rule is:

> A new application should not require new Keynu core code.

## Primary application extension model

```text
Runtime / KAP
   ↓
Capability Registry
   ↓
Integration Hub
   ↓
App Registry
   ↓
Generic Connector OR optional Integration Pack
   ↓
Application
```

Applications register through versioned manifests in `config/integrations/`. A manifest declares identity, connection type, capabilities and risk metadata. The Hub turns those declarations into runtime capabilities dynamically.

## Connectors versus domain semantics

A **Connector** answers: *How does Keynu communicate with this application?*

Examples:

- CLI
- File/project artifacts
- HTTP (future governed connector)
- MCP (future)
- Browser (future)
- WebSocket (future)

An **Integration Pack** answers: *What app-specific meaning must Keynu understand?*

Most applications should need only a manifest and existing connector. A pack is appropriate when the runtime must enforce domain rules or interpret domain evidence. Melakat is an example because a research campaign requires canonical scientific validation evidence, not just process exit code 0.

## Shared Engineering Runtime

Application integrations must not reimplement generic software-engineering work. Filesystem, shell/process, PowerShell/Node/Python/Bash, Git and project verification belong to the central Engineering Runtime.

CLI and File connectors in Integration Hub v1 delegate to Engineering Runtime.

## Driver compatibility layer

The historical `Driver` interface still exists:

```text
initialize()
execute(command)
```

`DriverManager` remains because existing KAP/runtime paths and legacy integrations still target drivers. Integration Hub is currently exposed through one central `integration` Driver compatibility bridge.

Existing per-app Drivers may remain temporarily for direct legacy commands, but new app capabilities should not be hard-coded into `registerBuiltinDrivers.ts` when they can be declared by an app manifest.

This means:

```text
OLD
New App -> write NewAppDriver -> modify Keynu core -> register capabilities

NEW
New App -> add manifest -> choose connector -> optional domain pack
```

## Runtime discovery

The central Hub exposes:

```text
integration.listApps
integration.describeApp
integration.listCapabilities
integration.invoke
```

App capabilities use `<app-id>.<capability>` names and are registered dynamically from manifests.

## Melakat migration

Melakat is the first migrated application:

- `config/integrations/melakat.json` is its registration source;
- public `melakat.*` capabilities route through Integration Hub;
- the Melakat Integration Pack preserves research-specific semantics;
- the existing `MelakatDriver` remains temporarily as a compatibility implementation/direct-driver route.

The target follow-up is to move the remaining Melakat semantic implementation into the pack/service and leave any legacy driver as a thin adapter.

## Design rules

1. Register applications as data before writing app-specific runtime code.
2. Reuse an existing Connector whenever the connection protocol already exists.
3. Keep OS/IO/software-development operations in Engineering Runtime.
4. Add an Integration Pack only for genuine domain semantics.
5. Attach risk metadata to every app capability.
6. Connectors do not invent domain meaning.
7. Integration Packs do not duplicate generic transport or engineering tools.
8. Legacy Drivers are compatibility mechanisms, not the default application SDK.

## Long-term goal

Keynu should discover and operate arbitrary registered applications without accumulating one core Driver class per app. Over time, direct Integration Hub routing can replace even the central Driver compatibility bridge once CommandBus/runtime contracts are migrated safely.
