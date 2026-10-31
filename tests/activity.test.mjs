import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActivityTrace } from '../lib/activity.mjs';

test('actual service metadata stays in the initiating visitor context across asynchronous work', async () => {
  const trace = createActivityTrace();
  await Promise.all(['visitor-a', 'visitor-b'].map(visitorId => trace.run({ visitorId }, () => trace.track('openai', visitorId === 'visitor-a' ? 'First request' : 'Second request', async () => {
    await Promise.resolve(); return { ok: true, privateTranscript: 'NEVER RETAIN THIS' };
  }))));
  assert.equal(trace.read('visitor-a').length, 2);
  assert.ok(trace.read('visitor-a').every(e => e.operation === 'First request'));
  assert.ok(trace.read('visitor-b').every(e => e.operation === 'Second request'));
  assert.equal(JSON.stringify(trace.read('visitor-a')).includes('NEVER RETAIN'), false);
  assert.deepEqual(trace.read('another-visitor'), []);
  trace.record('openai', 'Unscoped background work', 'succeeded');
  assert.equal(trace.read('visitor-a').length, 2);
});

test('failed HTTP results and exceptions record failure without retaining provider errors', async () => {
  const trace = createActivityTrace();
  await trace.run({ visitorId: 'visitor-a' }, async () => {
    await trace.track('supabase', 'Vector query', async () => ({ ok: false, secret: 'HIDDEN' }));
    await assert.rejects(() => trace.track('relaycast', 'Recipient receipt', async () => { throw new Error('PRIVATE ERROR'); }));
  });
  assert.equal(trace.read('visitor-a').filter(e => e.status === 'failed').length, 2);
  assert.equal(JSON.stringify(trace.read('visitor-a')).includes('PRIVATE ERROR'), false);
});
