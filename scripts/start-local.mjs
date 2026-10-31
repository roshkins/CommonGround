import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const candidates = [...new Set([
  process.env.COMMON_GROUND_RELAY_NODE,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'hermes', 'node', 'node.exe'),
  process.execPath,
].filter(Boolean))];
const relayNode = candidates.find(path => existsSync(path) && spawnSync(path, ['-e', "const db=require('better-sqlite3')(':memory:'); db.close();"], { cwd: root, stdio: 'pipe', timeout: 10000 }).status === 0);
if (!relayNode) {
  console.error('No Node runtime matches the installed Relay SQLite binary. Install dependencies with Node 22 LTS, or set COMMON_GROUND_RELAY_NODE to that runtime.');
  process.exit(1);
}
const children = new Set(); let stopping = false; let appStarted = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code; }
function launch(runtime, script, onData) {
  const child = spawn(runtime, [script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.add(child);
  child.stdout.on('data', data => { process.stdout.write(data); onData?.(String(data)); });
  child.stderr.on('data', data => process.stderr.write(data));
  child.on('error', () => { console.error(`Could not launch ${script}.`); stop(1); });
  child.on('exit', code => { children.delete(child); if (!stopping) stop(code || 1); });
  return child;
}
launch(relayNode, 'scripts/relay-server.mjs', data => {
  if (!appStarted && data.includes('Official Relaycast engine:')) { appStarted = true; launch(process.execPath, 'server.mjs'); }
});
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
