# Keynu React Mission Control Dashboard — Information Architecture

## Status

- Mission: `react-mission-control-dashboard`
- Milestone: React dashboard architecture and application shell
- Purpose: Define the stable product and component boundaries before further React integration.

## Product Principle

The Dashboard is an operational Mission Control interface for understanding and controlling Keynu. It must prioritize readable system state, verified evidence, actionable recommendations, and safe navigation over decorative visual complexity.

The default knowledge-graph experience is a labelled and accessible 2D workspace. Three-dimensional visualization is optional and must not replace the readable 2D default.

## Primary Navigation

1. **Overview**
   - Active mission and milestone
   - Runtime health summary
   - Current recommendations
   - Recent verified activity
   - High-priority failures or blocked operations

2. **Knowledge Graph**
   - Large labelled 2D graph workspace
   - Search, filters, layout controls, legend and pagination
   - Node selection and details inspector
   - Neighbours, dependency impact and recent activity
   - Optional switch to the existing 3D graph mode

3. **Timeline**
   - Chronological runtime events
   - Jobs, commands, reports, failures and recovery events
   - Correlation by mission and job identifier

4. **Reports**
   - Verified KAP reports and certificates
   - Report status, execution evidence and delivery mode
   - Safe access to bounded summaries and persisted report metadata

5. **Memory**
   - Read-only repository memory workspace by default
   - Current state, next steps, decisions, architecture and startup context
   - Explicit edit controls only when a later mission authorizes mutation

6. **Processes**
   - Runtime process inventory
   - State, start time, exit information and logs
   - Safe process actions exposed only through supported APIs

7. **Drivers**
   - Registered drivers and capabilities
   - Readiness, connectivity and diagnostic state

8. **Repository**
   - Branch, working-tree status and recent revision information
   - Changed-file awareness
   - No implicit mutation from presentation components

9. **Settings and Diagnostics**
   - Theme and display preferences
   - API connectivity and client diagnostics
   - Accessibility and reduced-motion preferences

## Shared Application Shell

The application shell owns:

- persistent primary navigation;
- top command and status bar;
- route-level error boundary;
- global loading and offline indicators;
- responsive drawer behaviour;
- theme and accessibility preferences;
- command palette;
- selected mission context;
- API client and query-state providers.

Feature pages must not duplicate shell-level navigation or global runtime state.

## Layout Regions

### Desktop

- Left: persistent navigation rail or sidebar
- Centre: route workspace
- Right: contextual inspector when required
- Top: mission identity, search or command trigger, health state and connection status

### Tablet

- Collapsible navigation drawer
- Main workspace remains primary
- Inspector becomes resizable, collapsible or overlaid

### Mobile

- Navigation becomes a temporary drawer or compact bottom-level entry point
- Inspector becomes a full-width sheet or routed details view
- Graph controls collapse into grouped toolbars
- No horizontal page overflow
- Touch targets must remain usable
- Critical status must remain visible without relying on hover

## Route Boundaries

Suggested route hierarchy:

- `/` or `/overview`
- `/graph`
- `/graph/3d`
- `/timeline`
- `/reports`
- `/reports/:reportId`
- `/memory`
- `/processes`
- `/drivers`
- `/repository`
- `/diagnostics`

Routes should preserve selection and filters through URL state when practical.

## Component Boundaries

### Application components

- `MissionControlApp`
- `ApplicationShell`
- `PrimaryNavigation`
- `TopStatusBar`
- `CommandPalette`
- `RouteErrorBoundary`

### Overview components

- `MissionSummaryCard`
- `RuntimeHealthPanel`
- `RecommendationPanel`
- `RecentActivityPanel`
- `OperationalAlertPanel`

### Graph components

- `GraphWorkspace`
- `GraphToolbar`
- `GraphSearch`
- `GraphFilters`
- `GraphLegend`
- `GraphCanvas2D`
- `GraphPagination`
- `NodeInspector`
- `GraphModeSwitch`

### Operational data components

- `TimelineView`
- `ReportList`
- `ReportDetails`
- `MemoryWorkspace`
- `ProcessTable`
- `DriverGrid`
- `RepositoryStatusPanel`

## State Ownership

### Server-derived state

The server remains the source of truth for:

- mission and runtime state;
- effective graph nodes and edges;
- neighbours and dependency impact;
- recommendations and acknowledgement state;
- reports and verification evidence;
- memory documents;
- processes, drivers and repository status.

### Client-owned state

The React client may own:

- active route;
- temporary filters and search input;
- selected graph node;
- drawer and inspector visibility;
- graph viewport state;
- theme and accessibility preferences;
- transient command-palette state.

Client state must not impersonate successful runtime mutation before server confirmation.

## API Integration Boundary

- Use a single typed API client boundary.
- Keep endpoint details outside visual components.
- Parse and validate unexpected response shapes defensively.
- Represent loading, empty, stale, error and disconnected states explicitly.
- Preserve current Dashboard server contracts unless an independently verified migration requires change.
- Mutation controls must wait for confirmed API responses and surface failures.

## Knowledge Graph Experience

### Default 2D mode

The 2D graph must prioritize:

- readable labels;
- deterministic selection;
- keyboard navigation where feasible;
- search and node-kind filtering;
- relationship legend;
- multiple layouts;
- zoom and fit controls;
- node details inspector;
- direct-neighbour navigation;
- reverse dependency impact;
- recent activity;
- bounded rendering for large graphs.

### Optional 3D mode

The existing Three.js graph remains an optional analytical view. It must reuse safe Graph APIs and preserve its resource-cleanup, filtering, pagination, selection and request-revision protections.

## Command Palette

The command palette should provide navigation and safe UI actions first:

- navigate to a page;
- search graph nodes;
- open a report;
- focus a process or driver;
- switch theme;
- open diagnostics.

Runtime-changing commands require explicit supported APIs, clear confirmation where risk exists, and verified results.

## Accessibility

- Semantic landmarks and headings
- Keyboard-reachable navigation and controls
- Visible focus states
- Accessible names for icon-only actions
- Sufficient contrast
- Reduced-motion support
- Status changes communicated without colour alone
- Tables and inspectors usable with assistive technology
- Graph information also available through textual lists and inspector content

## Migration Strategy

1. Preserve the existing Dashboard and Graph APIs.
2. Build the React shell alongside the current implementation.
3. Integrate one feature area at a time.
4. Verify API parity and responsive behaviour after each integration.
5. Keep the 2D graph as the default graph route.
6. Reuse the existing 3D client only through a clearly isolated integration boundary.
7. Replace the prototype entry point only after functional parity and regression verification.

## Initial Delivery Sequence

1. Application shell, routes, theme and responsive navigation
2. Typed API client and shared query-state patterns
3. Overview and runtime health
4. Activity timeline
5. Readable 2D graph workspace and node inspector
6. Existing 3D graph integration
7. Reports and repository memory
8. Processes, drivers and repository status
9. Command palette, accessibility and performance polish
10. API, responsive and regression verification

## Non-goals for the Current Milestone

- Redesigning Keynu runtime architecture
- Replacing canonical graph services
- Moving server truth into browser state
- Adding unsafe direct shell execution from React
- Replacing the readable 2D graph with a 3D-only interface
- Breaking or silently changing existing Dashboard APIs

## Acceptance Criteria

- The information architecture is stored in the repository.
- Navigation and route boundaries are explicit.
- Desktop, tablet and mobile behaviour is defined.
- Server and client state ownership are separated.
- The 2D-first graph principle is documented.
- Migration preserves existing APIs until verified replacement.
- Accessibility and command-safety expectations are explicit.
