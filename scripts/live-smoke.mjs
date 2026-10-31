import WebSocket from 'ws';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { readConfig } from '../lib/config.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = readConfig(root);
const began = Date.now(), audio = [], counts = {};
const result = { model: config.liveModel, started: false, firstAudioMs: null, audioBytes: 0 };
const ws = new WebSocket('wss://api.openai.com/v1/live/sessions', { headers: { Authorization: `Bearer ${config.openaiKey}` }, handshakeTimeout: 10000 });
let quietTimer, audioClock;
const finish = () => { try { ws.send(JSON.stringify({ type: 'session.close' })); } catch {} ws.close(); };
const deadline = setTimeout(finish, 25000);
ws.on('open', () => ws.send(JSON.stringify({ type: 'session.start', session: {
  model: config.liveModel || 'gpt-live-1', instructions: 'You are a friendly telephone advocate. Speak Albanian for this short connection test.',
  audio: { format: { type: 'audio/pcmu', rate: 8000 }, output: { voice: config.liveVoice || 'marin' } },
} })));
ws.on('message', raw => {
  let event; try { event = JSON.parse(raw); } catch { return; }
  counts[event.type] = (counts[event.type] || 0) + 1;
  if (event.type === 'session.started') {
    result.started = true;
    ws.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: null, content: 'Greet the caller now in Albanian: Përshëndetje! Jam avokati juaj i CommonGround. Si mund t’ju ndihmoj?' }));
    const silence = Buffer.alloc(160, 255).toString('base64');
    audioClock = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.input_audio.append', audio: silence })); }, 20);
  }
  if (event.type === 'session.output_audio.delta' && event.delta) {
    if (result.firstAudioMs === null) result.firstAudioMs = Date.now() - began;
    const bytes = Buffer.from(event.delta, 'base64'); audio.push(bytes); result.audioBytes += bytes.length;
    clearTimeout(quietTimer); quietTimer = setTimeout(finish, 2000);
  }
  if (event.type === 'error') result.errorCode = event.error?.code || event.error?.type || 'provider_error';
});
ws.on('error', () => { result.connectionError = true; });
await new Promise(resolve => ws.on('close', resolve));
clearTimeout(deadline); clearTimeout(quietTimer); clearInterval(audioClock);
if (audio.length) { await mkdir(join(root, 'artifacts'), { recursive: true }); await writeFile(join(root, 'artifacts', 'live-greeting.ulaw'), Buffer.concat(audio)); }
console.log(JSON.stringify({ ...result, elapsedMs: Date.now() - began, eventCounts: counts, note: 'OpenAI leg only; no telephone call placed or caller audio used.' }));
if (!result.started || !result.audioBytes) process.exitCode = 1;
