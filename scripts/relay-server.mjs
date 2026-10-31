import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@relaycast/engine';
import { createNodeRuntime } from '@relaycast/engine/adapters/node';

// Use the official engine, with a loopback-only HTTP adapter for the demo's REST DMs.
// No public listener, telemetry sink, webhooks, file uploads, or WebSocket clients are needed.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(root, 'data'), { recursive: true });
const bootstrapPath = join(root, 'data', 'relay-bootstrap-secret');
if (!existsSync(bootstrapPath)) writeFileSync(bootstrapPath, randomBytes(32).toString('hex'), { mode: 0o600 });
const runtime = createNodeRuntime({ dbPath: join(root, 'data', 'relay.sqlite'), baseUrl: 'http://127.0.0.1:8787', fileDir: join(root, 'data', 'relay-files'),
  config: { workspaceBootstrapSecret: readFileSync(bootstrapPath, 'utf8').trim() } });
const engine = createEngine(runtime.deps);
const server = http.createServer(async (req, res) => {
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '') || req.headers.origin) {
    res.writeHead(403); res.end('Local server-to-server transport only.'); return;
  }
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {}),
    });
    const response = await engine.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Relay request failed.'); }
});
server.listen(8787, '127.0.0.1', () => console.log('Official Relaycast engine: http://127.0.0.1:8787 (local REST transport)'));
server.on('close', () => runtime.close());
server.on('error', error => { console.error(`Relay could not start (${error.code}).`); runtime.close(); process.exitCode = 1; });
