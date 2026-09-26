# Targeted Failure Escalation

Keynu should not turn a local execution failure into a repository-wide AI investigation.

When a mission step blocks, the execution runner now creates an `escalation-ready` evidence record. `EscalationController` builds that packet from the failed step only.

The packet is bounded to 6,000 serialized characters by default and contains:

- plan and step identity;
- the failed step goal;
- the failure message;
- at most six recent relevant evidence records from that step;
- the step's allowlisted functions;
- instructions to diagnose only the observed failure and request at most a minimal repair or one missing artifact.

It deliberately excludes general mission memory, unrelated steps, broad repository history and arbitrary file contents.

```text
deterministic execution
        |
        +---- PASS ----> persist + continue (AI calls: 0)
        |
        +---- FAIL
                |
                v
        relevant step evidence
                |
                v
       EscalationController
          <= 6,000 chars
                |
                v
        escalation-ready
                |
        targeted reasoning
          only if requested
```

Creating an escalation packet does not itself call an AI provider. It is persisted evidence that can be inspected first:

```bash
npm run mission -- escalation <config.json> <plan-id> <step-id>
```

Mission metrics also expose `escalationPackets` and the total serialized `escalationCharacters`.

For the IBM Bob 2.0 workflow, this is the handoff boundary we want: Keynu performs normal work locally; a failure produces a compact, evidence-backed diagnostic packet; Bob or another reasoning model receives only that packet when human/workflow policy chooses to escalate.
