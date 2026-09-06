# ADR-0013 — Application Integration Hub

**Status:** Accepted  
**Date:** 2026-09-07

## Context

Keynu historically extended external applications by adding one `Driver` class per application. That approach does not scale: application-specific drivers tend to accumulate repeated project-root resolution, filesystem, process, HTTP/CLI and verification mechanics even though Keynu now has a central Engineering Runtime.

The Melakat integration proved the need for two different concepts:

1. transport/connection mechanics — how Keynu reaches an application;
2. domain semantics — what an application-specific operation means and how its evidence is interpreted.

Those concepts should not require a new Keynu core driver for every new application.

## Decision

Keynu adopts an **Application Integration Hub** as the primary extension model.

A new application is registered through a versioned manifest in `config/integrations/*.json`. The manifest declares:

- application identity and optional Keynu project mapping;
- connection types;
- capabilities;
- risk metadata (`read`, `write`, `execute`);
- whether each capability is handled by a generic connector or an optional domain integration pack.

Generic connectors implement reusable connection mechanics. Integration Hub v1 ships with `cli` and `file` connectors, both delegating local execution/IO to the existing Engineering Runtime instead of creating new OS/IO implementations.

An **Integration Pack** is optional. It is used only for domain semantics that cannot safely be represented by a generic connector. Melakat is the first such pack because operations such as experiment validation, extinction evidence discovery and scientific artifact interpretation are domain-specific.

The existing Driver system remains as a compatibility transport for current KAP/runtime routing. A single `integration` driver exposes the Hub to the existing CommandBus. Existing per-app drivers may remain temporarily for backwards compatibility, but application capabilities should migrate to Integration Hub registration. New applications must not require new Keynu core code when a manifest plus existing connector is sufficient.

## Architectural rule

> A new application should not require new Keynu core code.

Preferred extension sequence:

1. register an app manifest;
2. select an existing connector;
3. declare capabilities and risk metadata;
4. add an Integration Pack only when domain semantics require code;
5. add a new generic connector only when a genuinely new connection protocol is needed.

## Consequences

### Positive

- avoids a growing `*Driver.ts` class per application;
- centralizes connection mechanics and application discovery;
- keeps Engineering Runtime as the shared OS/IO/software-development layer;
- makes capabilities discoverable from data rather than hard-coded registration;
- preserves domain-specific evidence semantics without contaminating connector code;
- allows compatibility migration instead of a disruptive Driver removal.

### Trade-offs

- DriverManager remains in the runtime during migration;
- Melakat Integration Pack v1 delegates to the proven MelakatDriver implementation internally, while public `melakat.*` capabilities route through Integration Hub; this is a compatibility bridge, not the target end state;
- connector manifests are trusted Keynu configuration and must remain governed because an `execute` capability can launch a declared CLI.

## Follow-up

- move Melakat semantic implementation out of `MelakatDriver` into its Integration Pack/service, leaving any legacy driver as a thin adapter;
- migrate Dehlero/Blender where generic connectors are sufficient;
- add governed HTTP/MCP/Browser/WebSocket connectors as needed;
- eventually allow CommandBus to route Integration Hub capabilities directly so even the central compatibility driver can become optional.
