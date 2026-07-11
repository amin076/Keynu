import { executeKapCommandJob } from './kap-job-router.js';

async function smokeTest() {
  const report = await executeKapCommandJob({
    jobId: 'test-command-job',
    cwd: process.cwd(),
    commands: [
      { command: 'node', args: ['-v'] },
    ],
  });

  if (report.payload.status !== 'COMPLETED') {
    throw new Error('Smoke test failed');
  }
}

void smokeTest();
