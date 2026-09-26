# Bounded Automatic Recovery

Keynu can optionally recover a failed mission step without reopening broad project context.

Recovery is **off by default**. A plan step must explicitly opt in:

```json
"recovery": {
  "enabled": true,
  "maxAttempts": 1
}
```

When an action or verification fails:

1. Keynu creates the existing bounded `FAILURE_ESCALATION` packet (default maximum 6,000 serialized characters).
2. Keynu persistently reserves one recovery attempt and one normal AI-call budget unit.
3. The repair agent receives only that escalation packet.
4. It may return at most six repair calls, all of which must already be in the step's `allowedFunctions`.
5. Keynu executes the repair through the normal FunctionRegistry.
6. Keynu reruns the step's deterministic verification.
7. Only verified recovery marks the step complete and allows the mission scheduler to continue.

If evidence is insufficient, the repair agent can return `stop`. If a repair call is unsafe, fails, or verification still fails, the step remains `BLOCKED`.

```text
local execution
      |
    failure
      |
      v
bounded escalation <= 6k chars
      |
      v
one targeted repair decision
      |
      +-- stop ----------> BLOCKED
      |
      +-- repair calls (max 6, allowlisted)
              |
              v
       deterministic verification
              |
         +----+----+
         |         |
       PASS       FAIL
         |         |
     continue    BLOCKED
```

## Budgets

Recovery attempts are persisted in step state, so restart/resume cannot silently reset them. `maxAttempts` is limited to 1..3. Repair reasoning also consumes the existing persistent `maxAiCalls` budget; recovery is not a hidden second AI budget.

Mission metrics report `recoveryAttempts` and `successfulRecoveries`.

## IBM Bob 2.0 demo

This creates the intended handoff boundary for Keynu: ordinary work remains local and deterministic; only a compact observed anomaly is eligible for expensive reasoning; a repair is then executed and verified by Keynu.

The implementation does not claim Bobcoin savings until the workflow is measured in a real Bob session.
