import type { CodexKapJob, CodexKapReport } from "./codex.types.js";

export function createCodexPrompt(job: CodexKapJob): string {
  const instructions = normalizeInstructionBlock(job.payload.task.instructions);
  const projectName = job.payload.projectName ?? inferProjectName(job);
  const avoidChanging = uniqueList([
    ...(job.payload.avoidFiles ?? []),
    ...(job.payload.task.avoidChanging ?? []),
  ]);
  const constraints = job.payload.task.constraints ?? [];

  const lines = [
    `# ${projectName} Codex Task`,
    "",
    "You are Codex acting as an AI coding agent for Keynu.",
    "This prompt was prepared by Keynu from a KAP job, but KAP is only being used for routing, job tracking, and report tracking.",
    "Treat the work below as a normal coding-agent task written in natural English.",
    "",
    "## Project",
    "",
    `- Project name: ${projectName}`,
    `- Repository: ${job.payload.repo ?? "not specified"}`,
    `- Local path: ${job.payload.localPath ?? "not specified"}`,
    `- KAP job id: ${job.id}`,
    "",
    "## Why This Is an Agent Bridge",
    "",
    "Codex is not a normal application driver like a YouTube, Blender, Dehlero, or Esbiko integration.",
    "Normal app drivers need strict KAP JSON because Keynu is calling deterministic app operations.",
    "Codex is an AI coding agent, so the useful instruction is clear natural English with project context, constraints, and expected output.",
    "Keep KAP in mind only as the outer envelope Keynu uses to route this job and convert your final answer back into a KAP report.",
    "",
    "## Existing Keynu ChatGPT Flow",
    "",
    "Keynu already bridges ChatGPT through its browser-agent loop:",
    "1. ChatGPT sends a KAP job in a conversation.",
    "2. Keynu's BrowserAgent extracts the KAP envelope from the assistant message.",
    "3. Keynu executes the job through its runtime and drivers.",
    "4. Keynu sends a KAP report back into ChatGPT.",
    "",
    "The intended bridge is: ChatGPT -> Keynu -> Codex -> Keynu -> ChatGPT.",
    "",
    "## Current Task",
    "",
    `Title: ${job.payload.task.title}`,
    "",
    "Instructions:",
    ...instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    ...formatOptionalTextSection("Additional context", job.payload.task.context),
    ...formatOptionalListSection("Constraints", constraints),
    ...formatOptionalObjectSection("Keynu routing context", job.payload.context),
    "",
    "## Files and Areas to Avoid",
    "",
    ...(avoidChanging.length > 0
      ? avoidChanging.map((file) => `- ${file}`)
      : [
          "- Do not modify unrelated Keynu drivers.",
          "- Do not modify Dehlero, Esbiko, Blender, or YouTube code.",
        ]),
    "",
    "## Output Format",
    "",
    "When finished, return exactly these sections so Keynu can parse your answer into a KAP report:",
    "",
    "Changed files",
    "Summary",
    "Commands run",
    "Any errors",
    "How to test",
    "Next recommended step",
  ];

  return `${lines.join("\n")}\n`;
}

export function createPendingCodexReport(
  job: CodexKapJob,
  promptPath: string,
  reportPath: string,
): CodexKapReport {
  return {
    protocol: "KAP",
    version: "1.0",
    type: "REPORT",
    id: `report-${job.id}`,
    createdAt: new Date().toISOString(),
    payload: {
      jobId: job.id,
      target: "codex",
      status: "PENDING",
      manualBridge: true,
      promptPath,
      reportPath,
    },
  };
}

function normalizeInstructionBlock(instructions: string[] | string): string[] {
  if (typeof instructions === "string") {
    return instructions
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  return instructions.map((instruction) => instruction.trim()).filter(Boolean);
}

function inferProjectName(job: CodexKapJob): string {
  if (job.payload.repo) {
    return job.payload.repo.split("/").at(-1) ?? "Keynu";
  }

  return "Keynu";
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatOptionalTextSection(label: string, value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return ["", `${label}:`, value.trim()];
}

function formatOptionalListSection(label: string, values: string[]): string[] {
  const cleaned = uniqueList(values);

  if (cleaned.length === 0) {
    return [];
  }

  return ["", `${label}:`, ...cleaned.map((value) => `- ${value}`)];
}

function formatOptionalObjectSection(
  label: string,
  value?: Record<string, unknown>,
): string[] {
  if (!value || Object.keys(value).length === 0) {
    return [];
  }

  return [
    "",
    `${label}:`,
    "```json",
    JSON.stringify(value, null, 2),
    "```",
  ];
}
