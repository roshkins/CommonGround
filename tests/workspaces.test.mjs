import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceManager, createMemoryRecordAdapter } from '../lib/workspaces.mjs';
import { rehearsalProposal } from '../lib/domain.mjs';

const ALICE = 'visitor-alice-0001', BOB = 'visitor-bob-00002', CAROL = 'visitor-carol-0003';
function setup(overrides = {}) {
  const sent = [];
  const services = {
    status: () => ({ openai: 'missing' }),
    understand: async input => ({ summary: input, goal: input, constraints: [], question: 'Anything else?', shareSuggestion: input, allowed: true }),
    negotiate: async room => { assert.ok(room.participants.tea.shared); return { content: rehearsalProposal(), exchange: [] }; },
    shareAuthorizedBrief: async intent => { sent.push(intent); return { receipts: [{ id: intent.requestId, from: intent.perspective, to: 'garage', payload: { kind: 'authorized-brief', en: intent.brief, 'zh-Hant': intent.brief }, verified: true }] }; },
    ...overrides,
  };
  return { manager: createWorkspaceManager({ root: '.', config: () => ({ workspaceStorage: 'memory' }), services, recordAdapter: createMemoryRecordAdapter() }), sent };
}
async function publish(manager, id, brief, perspective = 'tea', transport = 'rehearsal') {
  let v = await manager.getView(id, perspective);
  v = await manager.execute(id, 'understand', { revision: v.revision, participant: perspective, text: brief, language: 'en', mode: 'rehearsal' });
  return manager.execute(id, 'share', { revision: v.revision, participant: perspective, brief, consent: true, draftId: v.self.draft.id, transport });
}

test('private workspaces and draft concerns are isolated; shared join is explicit and observer-only', async () => {
  const { manager } = setup();
  const a = await manager.execute(ALICE, 'understand', { text: 'PRIVATE ALICE needs access.', language: 'en', mode: 'rehearsal' });
  const b = await manager.getView(BOB);
  assert.notEqual(a.id, b.id); assert.equal(JSON.stringify(b).includes('PRIVATE ALICE'), false);
  const joined = await manager.execute(BOB, 'join');
  assert.equal(joined.workspace.mode, 'shared'); assert.equal(joined.workspace.isContributor, false);
  assert.equal(joined.contributors.length, 0); assert.equal(joined.approvals.length, 0);
  assert.equal(joined.self.draft, null);
  assert.equal((await manager.getView(ALICE)).workspace.mode, 'private');
});

test('authorizing one exact draft publishes only that brief and enrolls a real contributor, never seeds', async () => {
  const { manager } = setup();
  await manager.execute(ALICE, 'join'); await manager.execute(BOB, 'join');
  let a = await manager.execute(ALICE, 'understand', { text: 'PRIVATE PHONE NUMBER 555. Keep access open.', language: 'en', mode: 'rehearsal' });
  const input = { revision: a.revision, brief: 'Keep access open.', draftId: a.self.draft.id, transport: 'rehearsal' };
  await assert.rejects(manager.execute(ALICE, 'share', { ...input, consent: false }), { status: 400 });
  a = await manager.execute(ALICE, 'share', { ...input, consent: true });
  assert.equal(a.contributors.length, 1); assert.equal(a.approvals[0].participant, ALICE);
  const b = await manager.getView(BOB);
  assert.equal(JSON.stringify(b).includes('PRIVATE PHONE NUMBER'), false);
  assert.equal(b.contributors[0].brief, 'Keep access open.');
  assert.equal(b.self.shared, null); assert.equal(b.self.draft, null);
  assert.equal(b.participants.filter(p => p.shared).length, 1);
  await assert.rejects(manager.execute(BOB, 'decision', { version: 1, status: 'approved', reviewed: true }), { status: 403 });
});

test('decisions belong to visitor and version; new context invalidates previous approvals', async () => {
  const { manager } = setup();
  await manager.execute(ALICE, 'join'); await manager.execute(BOB, 'join');
  await publish(manager, ALICE, 'Keep vehicle access open.', 'garage');
  let a = await manager.execute(ALICE, 'negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
  assert.equal(a.proposal.version, 1); assert.equal(a.approvals.length, 1); assert.equal(a.allApproved, false);
  a = await manager.execute(ALICE, 'decision', { revision: a.revision, version: 1, status: 'approved', reviewed: true });
  assert.equal(a.allApproved, true);
  await publish(manager, BOB, 'End music at nine.', 'craft');
  a = await manager.getView(ALICE);
  assert.equal(a.proposalStale, true); assert.equal(a.allApproved, false); assert.ok(a.approvals.every(d => d.status === 'outdated'));
  await assert.rejects(manager.execute(ALICE, 'decision', { version: 1, status: 'approved', reviewed: true }), { status: 409 });
  a = await manager.execute(ALICE, 'negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
  assert.equal(a.proposal.version, 2); assert.equal(a.approvals.length, 2); assert.ok(a.approvals.every(d => d.status === 'pending'));
  await manager.execute(ALICE, 'decision', { version: 2, status: 'approved', reviewed: true });
  const b = await manager.execute(BOB, 'decision', { version: 2, status: 'rejected', reviewed: true, note: 'Need a quieter finish.' });
  assert.equal(b.allApproved, false); assert.equal(b.approvals.find(d => d.visitorId === ALICE).status, 'approved');
  assert.equal(b.approvals.find(d => d.visitorId === BOB).status, 'rejected');
});

test('shared reset forbidden; leaving and returning preserve prior shared contribution and decisions', async () => {
  const { manager } = setup();
  await manager.execute(ALICE, 'join'); await publish(manager, ALICE, 'Protect storefront access.');
  await manager.execute(ALICE, 'negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
  await manager.execute(ALICE, 'decision', { version: 1, reviewed: true, status: 'approved' });
  await assert.rejects(manager.execute(ALICE, 'restart'), { status: 403 });
  const privateView = await manager.execute(ALICE, 'private'); assert.equal(privateView.contributors.length, 0);
  const restored = await manager.execute(ALICE, 'join'); assert.equal(restored.contributors.length, 1); assert.equal(restored.allApproved, true);
  await manager.execute(CAROL, 'join'); assert.equal((await manager.getView(CAROL)).allApproved, true); // observer has no vote
});

test('reviewed Relay send persists intent and retry does not dispatch twice', async () => {
  const { manager, sent } = setup();
  const a = await publish(manager, ALICE, 'Allow morning deliveries.', 'garage', 'relaycast');
  const input = { revision: a.revision, participant: 'garage', brief: 'Allow morning deliveries.', consent: true, draftId: a.self.draft.id, transport: 'relaycast' };
  await manager.execute(ALICE, 'share', input);
  assert.equal(sent.length, 1);
  assert.equal((await manager.getParticipant(ALICE)).sendIntents[sent[0].requestId].status, 'delivered');
  await assert.rejects(manager.execute(ALICE, 'share', { ...input, requestId: sent[0].requestId, brief: 'Changed exact terms.' }), { status: 409 });
  const edited = await manager.execute(ALICE, 'share', { ...input, brief: 'Allow deliveries until seven.', consent: true });
  assert.equal(sent.length, 2); assert.equal(edited.contributors[0].shareRevision, 2);
});

test('a failed Relay dispatch leaves recoverable pending intent and does not publish the brief', async () => {
  let working = false;
  const { manager } = setup({ shareAuthorizedBrief: async () => { if (!working) { const e = new Error('Relay offline'); e.status = 503; throw e; } return { receipts: [] }; } });
  let v = await manager.execute(ALICE, 'understand', { text: 'Keep the garage open.', language: 'en', mode: 'rehearsal' });
  const input = { participant: 'tea', brief: 'Keep the garage open.', consent: true, draftId: v.self.draft.id, transport: 'relaycast' };
  await assert.rejects(manager.execute(ALICE, 'share', input), { status: 503 });
  assert.equal((await manager.getView(ALICE)).contributors.length, 0);
  assert.equal(Object.values((await manager.getParticipant(ALICE)).sendIntents)[0].status, 'pending');
  working = true; v = await manager.execute(ALICE, 'share', input); assert.equal(v.contributors.length, 1);
});

test('actor-style compare-and-set rejects stale writes and changing context prevents stale model commit', async () => {
  let release, called;
  const waiting = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { called = resolve; });
  const { manager } = setup({ negotiate: async () => { called(); await waiting; return { content: rehearsalProposal(), exchange: [] }; } });
  await manager.execute(ALICE, 'join'); await manager.execute(BOB, 'join'); await publish(manager, ALICE, 'Keep access open.');
  const pending = manager.execute(ALICE, 'negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
  await began;
  await publish(manager, BOB, 'Finish music at nine.', 'craft');
  release(); await assert.rejects(pending, { status: 409 });
  assert.equal((await manager.getView(ALICE)).proposal, null);
});

test('phone and watch fields stay private and participant patches cannot switch room or identity', async () => {
  const { manager } = setup();
  await manager.patchParticipant(ALICE, { needs: 'Garage access', phone: { secret: 'PRIVATE-PAIRING' }, watch: { enabled: true }, mode: 'shared', visitorId: BOB });
  const p = await manager.getParticipant(ALICE); assert.equal(p.visitorId, ALICE); assert.equal(p.mode, 'private');
  assert.equal(p.watch.enabled, true);
  assert.equal(JSON.stringify(await manager.getView(BOB)).includes('PRIVATE-PAIRING'), false);
  assert.equal(JSON.stringify(await manager.getView(ALICE)).includes('PRIVATE-PAIRING'), false);
});

test('a new observer may join while advocates work without discarding an otherwise current proposal', async () => {
  let release, began;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { began = resolve; });
  const { manager } = setup({ negotiate: async () => { began(); await gate; return { content: rehearsalProposal(), exchange: [] }; } });
  await manager.execute(ALICE, 'join'); await publish(manager, ALICE, 'Protect delivery access.');
  const run = manager.execute(ALICE, 'negotiate', { mode: 'rehearsal', transport: 'rehearsal' });
  await started; await manager.execute(BOB, 'join'); release();
  const result = await run;
  assert.equal(result.proposal.version, 1); assert.equal(result.sharedContext.observerCount, 1);
  assert.equal((await manager.getView(BOB)).proposal.version, 1);
});
