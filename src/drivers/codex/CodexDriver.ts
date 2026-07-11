import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Driver, DriverResult } from "../../core/Driver.js";
import { createCodexPrompt, createPendingCodexReport } from "./codex.jobMapper.js";
import {
  createCompletedCodexReport,
  parseCodexResult,
} from "./codex.reportParser.js";
import {
  type CodexKapJob,
  type CodexKapReport,
  type CodexPrepareOptions,
  type CodexPrepareResult,
  isCodexKapJob,
} from "./codex.types.js";

type CodexCommand = {
  action: "prepare" | "parseReport";
  payload?: unknown;
};

type PrepareCommandPayload = {
  jobPath?: string;
  job?: unknown;
  outputRoot?: string;
};

type ParseReportCommandPayload = {
  jobId?: string;
  resultText?: string;
};

export class CodexDriver implements Driver {
  readonly id = "codex";

  async initialize(): Promise<void> {
    console.log("Codex Driver Ready (manual bridge v0.1)");
  }

  async execute(command: unknown): Promise<DriverResult> {
    const codexCommand = command as CodexCommand;

    if (codexCommand.action === "prepare") {
      const payload = codexCommand.payload as PrepareCommandPayload | undefined;

      if (payload?.jobPath) {
        await this.prepareJobFile(payload.jobPath, { outputRoot: payload.outputRoot });
        return { success: true, message: "Codex command completed." };
      }

      if (payload?.job) {
        await this.prepareJob(payload.job, { outputRoot: payload.outputRoot });
        return { success: true, message: "Codex command completed." };
      }

      throw new Error("Codex prepare requires payload.jobPath or payload.job.");
    }

    if (codexCommand.action === "parseReport") {
      const payload = codexCommand.payload as ParseReportCommandPayload | undefined;

      if (!payload?.jobId || !payload.resultText) {
        throw new Error("Codex parseReport requires payload.jobId and payload.resultText.");
      }

      parseCodexResult(payload.resultText);
      return { success: true, message: "Codex command completed." };
    }

    throw new Error(`Unknown Codex action: ${String(codexCommand.action)}`);
  }

  async prepareJobFile(
    jobPath: string,
    options: CodexPrepareOptions = {},
  ): Promise<CodexPrepareResult> {
    const raw = await readFile(jobPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return this.prepareJob(parsed, options);
  }

  async prepareJob(
    value: unknown,
    options: CodexPrepareOptions = {},
  ): Promise<CodexPrepareResult> {
    if (!isCodexKapJob(value)) {
      throw new Error("Invalid Codex KAP job. Expected protocol KAP v1.0 JOB with payload.target 'codex'.");
    }

    const job = value as CodexKapJob;
    const outputRoot = resolve(options.outputRoot ?? ".keynu/codex");
    const promptDir = resolve(outputRoot, "prompts");
    const reportDir = resolve(outputRoot, "reports");
    const fileId = toSafeFileId(job.id);
    const promptPath = resolve(promptDir, `${fileId}.md`);
    const reportPath = resolve(reportDir, `${fileId}.pending.json`);

    await mkdir(promptDir, { recursive: true });
    await mkdir(reportDir, { recursive: true });

    const prompt = createCodexPrompt(job);
    const report = createPendingCodexReport(job, promptPath, reportPath);

    await writeFile(promptPath, prompt, "utf8");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return {
      jobId: job.id,
      promptPath,
      reportPath,
      report,
    };
  }

  createCompletedReport(jobId: string, resultText: string): CodexKapReport {
    return createCompletedCodexReport(jobId, resultText);
  }

  async shutdown(): Promise<void> {}
}

function toSafeFileId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9._-]/g, "_");
}


