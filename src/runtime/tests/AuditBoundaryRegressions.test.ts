import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { executeFileSystemRequest } from '../../drivers/filesystem/filesystem-runtime-adapter.js';
import { assertWindowsShellArguments } from '../WindowsShellSafety.js';
import { HttpConnector } from '../../integrations/connectors/HttpConnector.js';
import type { IntegrationInvocationContext } from '../../integrations/IntegrationTypes.js';

for (const argument of ['x & whoami', '%PATH%', 'x|y', 'x\ny', 'x>file', 'x"y']) {
  assert.throws(() => assertWindowsShellArguments('npm.cmd', [argument]), /Unsafe/);
}
assertWindowsShellArguments('npm.cmd', ['run', 'test:all', 'path with spaces']);
const root = await mkdtemp(join(tmpdir(), 'keynu-boundary-'));
try {
  const project = join(root, 'project'), outside = join(root, 'outside');
  await mkdir(project); await mkdir(outside);
  if (process.platform !== 'win32') {
    await symlink(outside, join(project, 'escape'));
    await assert.rejects(executeFileSystemRequest(project, { action: 'writeFile', path: 'escape/oops', content: 'oops' }), /Symbolic/);
    await assert.rejects(readFile(join(outside, 'oops')), { code: 'ENOENT' });
  }
} finally { await rm(root, { recursive: true, force: true }); }
let escaped = 0;
const destination = createServer((_req, res) => { escaped++; res.end('escaped'); });
destination.listen(0, '127.0.0.1'); await once(destination, 'listening');
const server = createServer((_req, res) => {
  res.writeHead(302, { location: `http://127.0.0.1:${(destination.address() as { port: number }).port}/` }); res.end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const context: IntegrationInvocationContext = { projectRoot: process.cwd(), app: { schemaVersion: 'keynu-app-manifest-0.1', id: 'test', name: 'test', capabilities: [] }, capability: { name: 'redirect', risk: 'read', request: { path: '/redirect' } }, input: {} };
  const connector = { id: 'http', kind: 'http' as const, config: { baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` } };
  const result = await new HttpConnector().invoke(connector, context);
  assert.equal(result.success, false); assert.equal(escaped, 0);
  await assert.rejects(new HttpConnector().invoke(connector, { ...context, input: { timeoutMs: Infinity } }), /timeout/);
  console.log('Boundary regressions: batch shell metacharacters, symlink escape and cross-origin HTTP redirect passed.');
} finally { server.close(); destination.close(); server.closeAllConnections(); destination.closeAllConnections(); }
