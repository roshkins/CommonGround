// Verify the complete delivered video and create local caption/review sidecars.
// No publication, browser action, external request, or call occurs here.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const base = resolve('artifacts');
const file = resolve(base, 'CommonGround-demo-push-native.mp4');
const run = (args) => new Promise((done, fail) => {
  const child = spawn('C:/Users/Rashi/path/ffmpeg.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let error = '';
  child.stderr.on('data', chunk => error = (error + chunk).slice(-3000));
  child.on('error', fail);
  child.on('exit', code => code === 0 ? done() : fail(new Error(error)));
});
await run(['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', 'NUL']);
const shots = [
  { time: 1.2, name: 'push-native-qa-controls.png' },
  { time: 13, name: 'push-native-qa-receipt.png' },
  { time: 35, name: 'push-native-qa-phone.png' },
  { time: 109, name: 'push-native-qa-proposal.png' }
];
const results = await Promise.allSettled(shots.map(shot => run(['-hide_banner', '-loglevel', 'error', '-n', '-ss', String(shot.time), '-i', file, '-frames:v', '1', resolve(base, shot.name)])));
for (const result of results) if (result.status === 'rejected') throw result.reason;
const srt = await readFile(file.replace(/\.mp4$/, '.srt'), 'utf8');
const cues = (srt.match(/ --> /g) || []).length;
if (cues !== 35) throw new Error('Expected all four opening and thirty-one original caption cues.');
const vtt = 'WEBVTT\n\n' + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, (_, clock, ms) => `${clock}.${ms}`);
await writeFile(file.replace(/\.mp4$/, '.vtt'), vtt, { flag: 'wx' });
const metadataPath = file.replace(/\.mp4$/, '.json');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
metadata.qa = {
  completeAVDecode: true,
  sourceVisualReview: 'First, middle and last opening PNG checked: complete native1920x1080 backing surface; no tiling, crop or upscale. Original body source review preserved.',
  sourceLosslessRGBPixelProof: true,
  bytes: (await stat(file)).size,
  sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
  cueCount: cues,
  representativeFrames: shots.map(shot => shot.name),
  newOutboundConversationDepicted: false,
  humanPlaybackReview: 'Final representative frame review pending',
  publication: 'Public copy unchanged until root verifies and replaces it'
};
await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ file, seconds: metadata.durationSeconds, ...metadata.qa }));
