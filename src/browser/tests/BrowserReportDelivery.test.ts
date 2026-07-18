import { strict as assert } from "node:assert";
import {
  MAX_BROWSER_REPORT_CHARS,
  createBrowserReport,
  serializeBrowserReport,
} from "../BrowserReportDelivery.js";

const hugeOutput = "x".repeat(200000);
const report = {
  protocol: "KAP",
  version: "1.0",
  type: "REPORT",
  id: "report-large-test",
  createdAt: new Date().toISOString(),
  payload: {
    jobId: "large-test",
    target: "powershell",
    status: "COMPLETED",
    result: {
      jobId: "large-test",
      status: "COMPLETED",
      commands: [
        {
          command: "node",
          args: ["-e", "test"],
          ok: true,
          stdout: hugeOutput,
          stderr: "",
        },
      ],
      reads: [
        {
          path: "large.txt",
          ok: true,
          content: hugeOutput,
          originalBytes: hugeOutput.length,
        },
      ],
      writes: [],
      errors: [],
    },
  },
};

const compact = createBrowserReport(report);
assert.equal(compact.payload.delivery.fullReportPersisted, true);
assert.equal(compact.payload.result.commands[0].output.length < 2000, true);
assert.equal(compact.payload.result.reads[0].preview.length < 1000, true);

const serialized = serializeBrowserReport(report);
const fence = String.fromCharCode(96).repeat(3);
assert(serialized.startsWith(fence + "kap\n"));
assert(serialized.endsWith("\n" + fence));
assert(serialized.length < MAX_BROWSER_REPORT_CHARS + 1000);
assert(!serialized.includes(hugeOutput));

console.log("Browser report delivery tests passed.");
