import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { PEOPLE } from '../lib/domain.mjs';

test('HTTP rehearsal covers consent, negotiation, decisions, version invalidation, and secret boundaries', async () => {
  const { server } = createApp({ dbPath: ':memory:', config: () => ({ openaiKey: '', model: 'test', relayUrl: 'http://127.0.0.1:8787' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let revision = 0;
  const post = async (path, body) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, participant: 'tea', ...body }) });
    const data = await response.json(); if (response.ok && data.revision != null) revision = data.revision; return { response, data };
  };
  try {
    assert.equal((await fetch(base)).status, 200);
    for (const path of ['/.env', '/data/common-ground.sqlite', '/lib/config.mjs', '/.git/config']) assert.equal((await fetch(base + path)).status, 404);
    const blocked = await fetch(base + '/api/state', { headers: { Origin: 'https://another-site.example' } }); assert.equal(blocked.status, 403);
    const premature = await post('/api/negotiate', { mode: 'rehearsal', transport: 'rehearsal' }); assert.equal(premature.response.status, 409);
    for (const p of PEOPLE) {
      const understood = await post('/api/understand', { participant: p.id, text: p.seed.en, mode: 'rehearsal', language: 'en' });
      assert.equal(understood.response.status, 200);
      const invalid = await post('/api/share', { participant: p.id, brief: p.seed.en, draftId: understood.data.self.draft.id, consent: false }); assert.equal(invalid.response.status, 400);
      const shared = await post('/api/share', { participant: p.id, brief: p.seed.en, draftId: understood.data.self.draft.id, consent: true }); assert.equal(shared.response.status, 200);
    }
    const negotiated = await post('/api/negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
    assert.equal(negotiated.response.status, 200); assert.equal(negotiated.data.proposal.version, 1);
    assert.equal(negotiated.data.exchanges.length, 4); assert.ok(negotiated.data.exchanges.every(e => e.verified === false));
    assert.equal(negotiated.data.allApproved, false);
    for (const p of PEOPLE) assert.equal((await post('/api/decision', { participant: p.id, version: 1, status: 'approved', reviewed: true })).response.status, 200);
    let state = await (await fetch(base + '/api/state')).json(); assert.equal(state.allApproved, true);
    const revised = await post('/api/revise', { version: 1, note: 'End music at 8 pm instead.' });
    assert.equal(revised.data.proposal.version, 2); assert.equal(revised.data.allApproved, false); assert.ok(revised.data.approvals.every(a => a.status === 'pending'));
    const old = await post('/api/decision', { version: 1, status: 'approved', reviewed: true }); assert.equal(old.response.status, 409);
    const exported = await (await fetch(base + '/api/export')).json(); assert.ok(exported.label.includes('NOT REAL OWNER CONSENT')); assert.equal('self' in exported, false);
    const invalidRevision = await post('/api/decision', { revision: 0, version: 2, status: 'approved', reviewed: true }); assert.equal(invalidRevision.response.status, 409);
    const live = await post('/api/understand', { text: 'Please preserve access.', mode: 'live', language: 'en' }); assert.equal(live.response.status, 503);
    const restarted = await post('/api/restart', {}); assert.equal(restarted.data.proposal, null); assert.ok(restarted.data.participants.every(p => p.shared === null));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
