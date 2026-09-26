# Reasoning Gate

Keynu must not call an AI model merely because a mission step exists.

Every execution-plan step now declares an execution mode:

- `reasoning` (default): ambiguity or judgment remains, so Keynu requests a bounded AI decision.
- `deterministic`: the plan already contains explicit, reviewed function calls. Keynu executes and verifies them without reserving an AI call.

Example:

```json
{
  "id": "build-and-check",
  "goal": "Run the already-approved local validation",
  "executionMode": "deterministic",
  "deterministicActions": [
    { "name": "project.list", "args": {} }
  ],
  "allowedFunctions": ["project.list"],
  "verification": [
    { "name": "project.list", "args": {} }
  ],
  "maxAiCalls": 2,
  "dependsOn": []
}
```

The gate is intentionally explicit rather than heuristic. Keynu does **not** guess that an arbitrary task is safe to run without reasoning. Deterministic actions must already be present in the validated plan and every action and verification function must be allowlisted.

Both paths record `reasoning-gate` evidence. Mission metrics report `aiBypassedSteps` and `reasoningRequiredSteps`.

Safety remains unchanged: function schemas, allowed-function checks, project-root confinement, evidence recording, fail-closed results, dependency ordering and deterministic verification still apply.

For the IBM Bob demo this enables a defensible pattern: Bob/AI is consulted for genuine engineering judgment, while explicit build/test/read/API/MCP work can continue in Keynu at zero additional reasoning calls.
