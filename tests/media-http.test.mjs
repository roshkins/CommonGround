import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

test('judge video supports seeking and rejects malformed ranges without exposing other files', async () => {
  const { server } = createApp({ dbPath: ':memory:', config: () => ({ openaiKey: '', model: 'test' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/judge.html`)).status, 200);
    const range = await fetch(`${base}/demo-final.mp4`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-type'), 'video/mp4');
    assert.match(range.headers.get('content-range'), /^bytes 0-99\/\d+$/);
    assert.equal((await range.arrayBuffer()).byteLength, 100);
    const suffix = await fetch(`${base}/demo-final.mp4`, { headers: { Range: 'bytes=-32' } });
    assert.equal(suffix.status, 206); assert.equal((await suffix.arrayBuffer()).byteLength, 32);
    for (const value of ['bytes=999999999999-', 'bytes=40-20', 'bytes=-', 'bytes=0-1,3-4']) {
      assert.equal((await fetch(`${base}/demo-final.mp4`, { headers: { Range: value } })).status, 416);
    }
    const captions = await fetch(`${base}/demo-final.vtt`);
    assert.match(await captions.text(), /^WEBVTT/);
    const preview = await fetch(`${base}/demo-outreach-en.mp3`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(preview.status, 206); assert.equal(preview.headers.get('content-type'), 'audio/mpeg');
    assert.equal((await preview.arrayBuffer()).byteLength, 100);
    assert.equal((await fetch(`${base}/artifacts/user-call-english.m4a`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
