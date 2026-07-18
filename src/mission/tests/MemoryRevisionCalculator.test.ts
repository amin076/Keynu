import { strict as assert } from "node:assert";
import { MemoryRevisionCalculator } from "../MemoryRevisionCalculator.js";
import type { MissionContext } from "../MissionTypes.js";

function createContext(): MissionContext {
  return {
    project: {
      id: "keynu",
      name: "Keynu",
      root: "C:/Physics/Keynu",
      activeMissionId: "knowledge-graph-engine",
    },
    mission: {
      id: "knowledge-graph-engine",
      projectId: "keynu",
      title: "Knowledge Graph Engine",
      goal: "Build graph-driven runtime intelligence.",
      status: "ACTIVE",
      currentMilestone: "Mission Bootstrap V2",
      completedMilestones: [],
      nextMilestones: ["React dashboard"],
      rules: [],
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    memory: [
      {
        name: "current_state.md",
        path: "C:/Physics/Keynu/.keynu/memory/current_state.md",
        content: "Current state\r\n",
        bytes: 15,
        modifiedAt: "2026-07-14T00:00:00.000Z",
        stale: false,
        exists: true,
      },
      {
        name: "next_steps.md",
        path: "C:\\Physics\\Keynu\\.keynu\\memory\\next_steps.md",
        content: "Next steps\n",
        bytes: 11,
        modifiedAt: "2026-07-14T00:00:00.000Z",
        stale: false,
        exists: true,
      },
    ],
    repository: {} as MissionContext["repository"],
    openTasks: [],
    rules: [],
    warnings: [],
    generatedAt: "2026-07-14T00:00:00.000Z",
    continuation: {
      currentMilestone: "Mission Bootstrap V2",
      pendingMilestones: ["React dashboard"],
      architectureDecisions: [],
      recommendedReading: [],
      knownLimitations: [],
      nextActions: [],
    },
  };
}

const calculator = new MemoryRevisionCalculator();
const first = calculator.calculate(createContext());
const second = calculator.calculate(createContext());

assert.equal(first.algorithm, "sha256");
assert.equal(first.revision.length, 64);
assert.equal(first.revision, second.revision);
assert.equal(first.sourceCount, 4);
assert.equal(
  first.sources.some(
    (source) => source.path === ".keynu/memory/current_state.md",
  ),
  true,
);
assert.equal(
  first.sources.some(
    (source) => source.path === ".keynu/memory/next_steps.md",
  ),
  true,
);
assert.equal(
  first.sources.some((source) => /^[A-Za-z]:\//.test(source.path)),
  false,
);

const changedContext = createContext();
changedContext.memory[0]!.content = "Changed current state\n";
const changed = calculator.calculate(changedContext);
assert.notEqual(first.revision, changed.revision);

const reorderedContext = createContext();
reorderedContext.memory.reverse();
const reordered = calculator.calculate(reorderedContext);
assert.equal(first.revision, reordered.revision);

const timestampOnlyContext = createContext();
timestampOnlyContext.memory[0]!.modifiedAt = "2030-01-01T00:00:00.000Z";
const timestampOnly = calculator.calculate(timestampOnlyContext);
assert.equal(first.revision, timestampOnly.revision);

const differentRootContext = createContext();
differentRootContext.memory[0]!.path =
  "D:/AnotherComputer/Keynu/.keynu/memory/current_state.md";
differentRootContext.memory[1]!.path =
  "D:/AnotherComputer/Keynu/.keynu/memory/next_steps.md";
const differentRoot = calculator.calculate(differentRootContext);
assert.equal(first.revision, differentRoot.revision);

console.log("MemoryRevisionCalculator tests passed.");
