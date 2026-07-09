import type { CodexKapReport, CodexParsedResult } from "./codex.types.js";

const SECTION_NAMES = [
  "Changed files",
  "Summary",
  "Commands run",
  "Any errors",
  "How to test",
  "Next recommended step",
] as const;

type SectionName = (typeof SECTION_NAMES)[number];

export function parseCodexResult(resultText: string): CodexParsedResult {
  const sections = splitSections(resultText);

  return {
    changedFiles: parseList(sections.get("Changed files") ?? ""),
    summary: cleanText(sections.get("Summary") ?? ""),
    commandsRun: parseList(sections.get("Commands run") ?? ""),
    errors: cleanText(sections.get("Any errors") ?? "None"),
    howToTest: cleanText(sections.get("How to test") ?? ""),
    nextRecommendedStep: cleanText(sections.get("Next recommended step") ?? ""),
    raw: resultText,
  };
}

export function createCompletedCodexReport(
  jobId: string,
  resultText: string,
): CodexKapReport {
  return {
    protocol: "KAP",
    version: "1.0",
    type: "REPORT",
    id: `report-${jobId}`,
    createdAt: new Date().toISOString(),
    payload: {
      jobId,
      target: "codex",
      status: "COMPLETED",
      manualBridge: true,
      result: parseCodexResult(resultText),
    },
  };
}

function splitSections(text: string): Map<SectionName, string> {
  const sections = new Map<SectionName, string>();
  const headingPattern = new RegExp(
    `^\\s*(?:#{1,6}\\s*)?(${SECTION_NAMES.map(escapeRegExp).join("|")})\\s*:?[ \\t]*$`,
    "gim",
  );

  const matches = [...text.matchAll(headingPattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const name = match[1] as SectionName;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    sections.set(name, text.slice(start, end).trim());
  }

  return sections;
}

function parseList(text: string): string[] {
  return cleanText(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none");
}

function cleanText(text: string): string {
  return text.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
