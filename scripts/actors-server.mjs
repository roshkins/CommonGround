import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../lib/config.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = readConfig(root);
if (process.platform === 'win32') throw new Error('Terse native runtime requires Linux/macOS. Run this service on the Freestyle Linux VM or in WSL2.');
const { startLocalActors } = await import('terse-sdk/dev');
const runtime = await startLocalActors({
  project: root,
  entrypoint: 'actors/room.ts',
  projectId: process.env.TERSE_PROJECT_ID || 'commonground',
  dataDir: process.env.TERSE_DATA_DIR || join(root, 'data', 'terse'),
  port: Number(process.env.TERSE_PORT || 7100),
  ...(config.terseKey ? { apiKey: config.terseKey } : {}),
});
console.log('Terse actor runtime ready on private loopback port 7100. Actor state uses the configured persistent directory.');
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await runtime.stop(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
await runtime.closed;
