import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync("src/browser/BrowserAgent.ts", "utf8");

assert(source.includes('import { RuntimeGraphTracer }'));
assert(source.includes('private readonly graphTracer = new RuntimeGraphTracer()'));
assert(source.includes('this.graphTracer.traceQueued(traceContext)'));
assert(source.includes('this.graphTracer.traceStarted(traceContext)'));
assert(source.includes('this.graphTracer.traceCompleted(traceContext, rawResult)'));
assert(source.includes('this.graphTracer.traceFailed(traceContext, error)'));
assert(source.includes('missionId: kap.metadata?.missionId'));
assert(source.includes('workflowId: kap.metadata?.workflowId'));

console.log("BrowserAgent runtime graph tracing integration tests passed.");
