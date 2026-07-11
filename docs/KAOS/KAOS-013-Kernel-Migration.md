# KAOS Kernel Migration

Goal:

Run the existing Browser Agent through the KAOS Kernel instead of constructing components directly.

Phase 1:
- BrowserService owns BrowserAgent lifecycle.
- RuntimeService owns Runtime lifecycle.
- DashboardService owns Dashboard lifecycle.

Phase 2:
- BrowserAgentApp only creates Kernel.
- Kernel registers services.
- Kernel.boot() starts everything.

Phase 3:
- Agent.ts becomes a compatibility layer.
- BrowserAgentApp becomes a thin bootstrap.

No functionality should change during migration. Only ownership and lifecycle change.