import type {
  MissionContext,
  MissionMemoryDocument,
} from "./MissionTypes.js";

export type ContextBudgetOptions = {
  maximumCharacters?: number;
  maximumMemoryCharacters?: number;
  maximumChangedFiles?: number;
  maximumOpenTasks?: number;
};

export type BudgetedMissionContext = MissionContext & {
  budget: {
    maximumCharacters: number;
    estimatedCharacters: number;
    truncated: boolean;
    removedMemoryDocuments: string[];
  };
};

const MEMORY_PRIORITY = [
  "current_state.md",
  "next_steps.md",
  "decisions.md",
  "architecture.md",
  "startup_prompt.md",
];

export class ContextBudgeter {
  private readonly maximumCharacters: number;
  private readonly maximumMemoryCharacters: number;
  private readonly maximumChangedFiles: number;
  private readonly maximumOpenTasks: number;

  constructor(options: ContextBudgetOptions = {}) {
    this.maximumCharacters = Math.max(
      8000,
      options.maximumCharacters ?? 48000,
    );
    this.maximumMemoryCharacters = Math.max(
      4000,
      options.maximumMemoryCharacters ?? 30000,
    );
    this.maximumChangedFiles = Math.max(
      10,
      options.maximumChangedFiles ?? 120,
    );
    this.maximumOpenTasks = Math.max(
      5,
      options.maximumOpenTasks ?? 40,
    );
  }

  apply(context: MissionContext): BudgetedMissionContext {
    const removedMemoryDocuments: string[] = [];
    const memory = this.budgetMemory(
      context.memory,
      removedMemoryDocuments,
    );

    const budgeted: BudgetedMissionContext = {
      ...context,
      memory,
      repository: {
        ...context.repository,
        changedFiles: context.repository.changedFiles.slice(
          0,
          this.maximumChangedFiles,
        ),
      },
      openTasks: context.openTasks.slice(0, this.maximumOpenTasks),
      budget: {
        maximumCharacters: this.maximumCharacters,
        estimatedCharacters: 0,
        truncated: removedMemoryDocuments.length > 0,
        removedMemoryDocuments,
      },
    };

    this.trimUntilWithinBudget(budgeted);
    budgeted.budget.estimatedCharacters = this.measure(budgeted);
    budgeted.budget.truncated =
      budgeted.budget.truncated ||
      context.repository.changedFiles.length > budgeted.repository.changedFiles.length ||
      context.openTasks.length > budgeted.openTasks.length;

    return budgeted;
  }

  private budgetMemory(
    documents: MissionMemoryDocument[],
    removed: string[],
  ): MissionMemoryDocument[] {
    let usedCharacters = 0;
    const sorted = [...documents].sort(
      (a, b) =>
        this.getMemoryPriority(a.name) - this.getMemoryPriority(b.name),
    );
    const selected: MissionMemoryDocument[] = [];

    for (const document of sorted) {
      if (!document.exists || typeof document.content !== "string") {
        selected.push(document);
        continue;
      }

      const remaining = this.maximumMemoryCharacters - usedCharacters;

      if (remaining <= 0) {
        removed.push(document.name);
        selected.push({ ...document, content: undefined });
        continue;
      }

      const content = document.content.slice(0, remaining);
      usedCharacters += content.length;

      if (content.length < document.content.length) {
        removed.push(document.name);
      }

      selected.push({
        ...document,
        content,
      });
    }

    return selected;
  }

  private trimUntilWithinBudget(context: BudgetedMissionContext): void {
    while (this.measure(context) > this.maximumCharacters) {
      const memoryDocument = [...context.memory]
        .reverse()
        .find(
          (document) =>
            typeof document.content === "string" && document.content.length > 0,
        );

      if (memoryDocument && typeof memoryDocument.content === "string") {
        const nextLength = Math.max(
          0,
          memoryDocument.content.length - 2000,
        );
        memoryDocument.content = memoryDocument.content.slice(0, nextLength);

        if (!context.budget.removedMemoryDocuments.includes(memoryDocument.name)) {
          context.budget.removedMemoryDocuments.push(memoryDocument.name);
        }

        context.budget.truncated = true;
        continue;
      }

      if (context.repository.changedFiles.length > 10) {
        context.repository.changedFiles = context.repository.changedFiles.slice(
          0,
          Math.max(10, context.repository.changedFiles.length - 20),
        );
        context.budget.truncated = true;
        continue;
      }

      if (context.openTasks.length > 5) {
        context.openTasks = context.openTasks.slice(
          0,
          context.openTasks.length - 1,
        );
        context.budget.truncated = true;
        continue;
      }

      break;
    }
  }

  private getMemoryPriority(name: string): number {
    const index = MEMORY_PRIORITY.indexOf(name);
    return index === -1 ? MEMORY_PRIORITY.length : index;
  }

  private measure(value: unknown): number {
    return JSON.stringify(value).length;
  }
}
