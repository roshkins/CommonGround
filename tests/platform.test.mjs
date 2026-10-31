import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { rehearsalProposal } from '../lib/domain.mjs';

test('modern HTTP platform isolates visitor cookies, shares only opt-in briefs, and never falls back to legacy room', async () => {
  const config = () => ({ workspaceStorage: 'memory', openaiKey: '', model: 'test', relayUrl: 'http://127.0.0.1:8787', publicOrigin: '', internalToken: 'internal-test-token' });
  const services = {
    status: () => ({ openai: 'missing', model: 'test' }),
    understand: async concern => ({ summary: concern, goal: concern, constraints: [], question: '', shareSuggestion: concern, allowed: true }),
    negotiate: async () => ({ content: rehearsalProposal(), exchange: [] }),
    shareAuthorizedBrief: async intent => ({ receipts: [{ id: intent.requestId, from: intent.perspective, to: 'garage', payload: { kind: 'authorized-brief', en: intent.brief }, verified: true }] }),
  };
  const app = createApp({ dbPath: ':memory:', config, services });
  const legacy = app.store.read(); legacy.participants.tea.draft = { original: 'LEGACY GLOBAL PRIVATE DRAFT' }; app.store.save(legacy, legacy.revision);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function browser() {
    let cookie = '';
    return {
      async request(path, input) {
        const result = await fetch(base + path, { method: input === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
        const set = result.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
        return { status: result.status, headers: result.headers, data: await result.json() };
      },
    };
  }
  const a = browser(), b = browser();
  try {
    const initialA = await a.request('/api/state'), initialB = await b.request('/api/state');
    assert.equal(initialA.status, 200); assert.ok(initialA.headers.get('set-cookie').includes('HttpOnly')); assert.ok(initialA.headers.get('set-cookie').includes('SameSite=Lax'));
    assert.notEqual(initialA.data.workspace.visitorId, initialB.data.workspace.visitorId);
    assert.notEqual(initialA.data.id, initialB.data.id);
    assert.equal(JSON.stringify(initialA.data).includes('LEGACY GLOBAL'), false);
    let understood = await a.request('/api/understand', { participant: 'garage', text: 'PRIVATE ACCOUNT DETAIL. Vehicle access until six.', language: 'en', mode: 'rehearsal', revision: initialA.data.revision });
    assert.equal(understood.status, 200);
    assert.equal(JSON.stringify((await b.request('/api/state')).data).includes('PRIVATE ACCOUNT DETAIL'), false);
    const ownActivity = await a.request('/api/activity'), otherActivity = await b.request('/api/activity');
    assert.equal(ownActivity.status, 200); assert.equal(otherActivity.status, 200);
    assert.ok(Array.isArray(ownActivity.data.events));
    assert.equal(JSON.stringify(otherActivity.data).includes('PRIVATE ACCOUNT DETAIL'), false);
    assert.equal((await a.request('/api/join', {})).data.workspace.isContributor, false);
    assert.equal((await b.request('/api/join', {})).data.workspace.mode, 'shared');
    assert.equal((await b.request('/api/decision', { version: 1, reviewed: true, status: 'approved' })).status, 403);
    understood = await a.request('/api/understand', { participant: 'garage', text: 'PRIVATE DETAILS. Keep access until six.', language: 'en', mode: 'rehearsal' });
    const shared = await a.request('/api/share', { participant: 'garage', brief: 'Keep access until six.', draftId: understood.data.self.draft.id, consent: true, transport: 'rehearsal', revision: understood.data.revision });
    assert.equal(shared.status, 200); assert.equal(shared.data.contributors.length, 1);
    const observer = (await b.request('/api/state')).data;
    assert.equal(observer.self.draft, null); assert.equal(observer.contributors[0].brief, 'Keep access until six.'); assert.equal(JSON.stringify(observer).includes('PRIVATE DETAILS'), false);
    // Public contributor IDs are identifiers, never session credentials.
    const forgedResponse = await fetch(base + '/api/state?participant=garage', { headers: { Cookie: `cg_visitor=${observer.contributors[0].visitorId}` } });
    const forged = await forgedResponse.json();
    assert.notEqual(forged.workspace.visitorId, observer.contributors[0].visitorId);
    assert.equal(forged.self.draft, null); assert.equal(forged.workspace.mode, 'private');
    const forgedSignatureResponse = await fetch(base + '/api/state?participant=garage', { headers: { Cookie: `cg_visitor=${observer.contributors[0].visitorId}.${'A'.repeat(43)}` } });
    const forgedSignature = await forgedSignatureResponse.json();
    assert.notEqual(forgedSignature.workspace.visitorId, observer.contributors[0].visitorId);
    assert.equal(forgedSignature.self.draft, null);
    const negotiated = await a.request('/api/negotiate', { mode: 'rehearsal', transport: 'rehearsal', revision: shared.data.revision });
    assert.equal(negotiated.status, 200); assert.equal(negotiated.data.approvals.length, 1);
    const voted = await a.request('/api/decision', { version: 1, status: 'approved', reviewed: true, revision: negotiated.data.revision });
    assert.equal(voted.status, 200); assert.equal(voted.data.allApproved, true);
    assert.equal((await b.request('/api/restart', {})).status, 403);
    const returned = await a.request('/api/private', {}); assert.equal(returned.data.workspace.mode, 'private');
    assert.equal(returned.data.self.draft?.original, undefined); // default tea perspective has no garage draft
    assert.equal((await a.request('/api/unknown-modern-action', {})).status, 404);
    const exported = await b.request('/api/export'); assert.equal(exported.status, 200); assert.ok(exported.data.label.includes('NOT REAL OWNER CONSENT')); assert.equal(JSON.stringify(exported.data).includes('PRIVATE DETAILS'), false);
    const unauthorized = await fetch(base + '/internal/phone/context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callSid: 'not-authorized' }) }); assert.equal(unauthorized.status, 403);
    const crossSite = await fetch(base + '/api/state', { headers: { Origin: 'https://another.example' } }); assert.equal(crossSite.status, 403);
  } finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); }
});
