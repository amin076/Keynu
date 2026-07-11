# KAOS Services

Services are long-lived runtime components managed by the Kernel.

Initial services:

- RuntimeService
- BrowserService
- DashboardService

Future services:

- MemoryService
- WorkspaceService
- DriverService
- SessionService
- SnapshotService
- GitService
- AIProviderService

All services will be registered through the Service Registry and communicate via the Event Bus rather than direct references.
