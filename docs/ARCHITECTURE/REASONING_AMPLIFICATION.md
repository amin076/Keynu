# Reasoning Amplification

Keynu should spend AI reasoning on decisions, not on every deterministic operation.

A mission execution decision may now return a bounded `batch` of up to 12 already-approved function calls. Keynu executes those calls sequentially through the existing FunctionRegistry, records intent and result evidence for every call, then returns to the reasoning loop with the observed evidence.

```text
one AI decision
      |
      v
bounded batch (max 12)
      |
      +-- function action
      +-- function action
      +-- function action
      |
      v
persist evidence
      |
      v
next targeted decision
      |
      v
deterministic verification
      |
      v
independent AI review
```

The batch does **not** bypass safety. Every call must still be in the step's `allowedFunctions`, uses the existing project-root confinement and function schemas, and stops on a failed result.

## Smaller execution context

The execution agent no longer receives the previous broad context allowance. Mission memory excerpts, prior plans and evidence history are individually bounded, and the complete decision context is capped at 20,000 serialized characters. When more information is required, the agent should request it through an approved function instead of receiving the repository by default.

## Metrics

After a mission plan runs:

```bash
npm run mission -- metrics <config.json> <plan-id>
```

Keynu reports:

- AI calls reserved by the persistent budget;
- deterministic function actions;
- verification actions;
- completed and blocked steps;
- actions per AI call.

These are Keynu runtime metrics. They must not be presented as Bobcoin savings unless an actual IBM Bob session measures that relationship.

For the hackathon demo, the useful comparison is a small reasoning request followed by multiple verified Keynu actions, persistence, and continuation.
