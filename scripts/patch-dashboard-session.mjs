import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/app/dashboardServer.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(from, to) {
  if (!source.includes(from)) {
    throw new Error('Patch target not found:\n' + from);
  }
  source = source.replace(from, to);
}

replaceOnce(
  'import { renderDashboardHtml } from "./dashboardHtml.js";\n',
  'import { renderDashboardHtml } from "./dashboardHtml.js";\nimport { getDashboardBrowser, getDashboardRuntime, readDashboardSession } from "./dashboardSession.js";\n',
);

replaceOnce(
  '        const reportSummary = getReportSummary(getLatestReport(history));\n\n        sendJson(response, 200, {',
  '        const reportSummary = getReportSummary(getLatestReport(history));\n        const session = readDashboardSession();\n        const dashboardRuntime = getDashboardRuntime(session);\n        const dashboardBrowser = getDashboardBrowser(session);\n\n        sendJson(response, 200, {',
);

replaceOnce(
  '          runtime: {\n            status: "RUNNING",\n            queue: "IDLE",\n            ...reportSummary,\n          },\n          browser: {\n            status: "CONNECTED",\n            watcher: "ACTIVE",\n            conversationUrl: process.env.KEYNU_CHATGPT_URL ?? "configured by browser agent",\n            lastSeenMessage: reportSummary.lastJob,\n          },',
  '          runtime: {\n            ...reportSummary,\n            ...dashboardRuntime,\n          },\n          browser: dashboardBrowser,\n          session,',
);

writeFileSync(path, source, 'utf8');
console.log('dashboardServer.ts patched with dashboardSession module.');
