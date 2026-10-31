import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { PEOPLE, createRoom, shareBrief, addProposal, recordDecision, publishView, proposalStale, assertCivic, rehearsalProposal } from '../lib/domain.mjs';
import { createStore } from '../lib/store.mjs';

function readyRoom() {
  const room = createRoom();
  for (const p of PEOPLE) {
    room.participants[p.id].draft = { id: `draft-${p.id}`, original: `PRIVATE ${p.id}`, understanding: { allowed: true } };
    shareBrief(room, { participant: p.id, brief: p.seed.en, consent: true, draftId: `draft-${p.id}` });
  }
  return room;
}
test('sharing requires explicit permission for the current reviewed draft', () => {
  const room = readyRoom();
  assert.throws(() => shareBrief(room, { participant: 'tea', brief: 'Keep access open.', consent: false, draftId: 'draft-tea' }), { status: 400 });
  assert.throws(() => shareBrief(room, { participant: 'tea', brief: 'Keep access open.', consent: true, draftId: 'old-draft' }), { status: 409 });
});
test('another participant sees authorized briefs but no raw private concerns', () => {
  const view = publishView(readyRoom(), 'garage');
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('PRIVATE tea'), false);
  assert.equal(serialized.includes('PRIVATE craft'), false);
  assert.equal(view.self.draft.original, 'PRIVATE garage');
  assert.ok(view.participants[0].shared.text);
});
test('agent output cannot create an owner decision', () => {
  const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  assert.equal(room.decisions.length, 0);
  assert.equal(publishView(room, 'tea').allApproved, false);
  assert.throws(() => recordDecision(room, { participant: 'tea', version: 1, status: 'approved', reviewed: false }), { status: 400 });
});
test('all approvals apply only to an exact proposal version; a new version starts pending', () => {
  const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  for (const p of PEOPLE) recordDecision(room, { participant: p.id, version: 1, status: 'approved', reviewed: true });
  assert.equal(publishView(room, 'tea').allApproved, true);
  addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  assert.equal(publishView(room, 'tea').allApproved, false);
  assert.ok(publishView(room, 'tea').approvals.every(a => a.status === 'pending'));
  assert.throws(() => recordDecision(room, { participant: 'tea', version: 1, status: 'approved', reviewed: true }), { status: 409 });
});
test('changed sharing makes the proposal outdated and blocks approval until a new draft', () => {
  const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  recordDecision(room, { participant: 'tea', version: 1, status: 'approved', reviewed: true });
  shareBrief(room, { participant: 'tea', brief: 'We now require the market to end by 8 pm.', consent: true, draftId: 'draft-tea' });
  assert.equal(proposalStale(room), true);
  assert.ok(publishView(room, 'tea').approvals.every(a => a.status === 'outdated'));
  assert.throws(() => recordDecision(room, { participant: 'garage', version: 1, status: 'approved', reviewed: true }), { status: 409 });
});
test('rejection is visible and never counts as approval', () => {
  const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  recordDecision(room, { participant: 'garage', version: 1, status: 'rejected', reviewed: true, note: 'The vehicle route is unresolved.' });
  assert.equal(publishView(room, 'tea').approvals[1].status, 'rejected');
  assert.equal(publishView(room, 'tea').allApproved, false);
});
test('an untranslated manual revision cannot be approved', () => {
  const room = readyRoom(); const proposal = addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  proposal.translationPending = true;
  assert.throws(() => recordDecision(room, { participant: 'tea', version: 1, status: 'approved', reviewed: true }), { status: 409 });
  assert.doesNotThrow(() => recordDecision(room, { participant: 'tea', version: 1, status: 'revise', reviewed: true, note: 'Please translate the addition.' }));
});
test('unrecognized source IDs and missing translations cannot enter a proposal', () => {
  const room = readyRoom();
  const badSource = rehearsalProposal(); badSource.en.evidenceIds.push('invented-hearing-rule');
  assert.throws(() => addProposal(room, badSource, 'live', 'relaycast'), { status: 502 });
  const untranslated = rehearsalProposal(); delete untranslated['zh-Hant'];
  assert.throws(() => addProposal(room, untranslated, 'live', 'relaycast'), { status: 502 });
  assert.equal(room.proposals.length, 0);
});
test('commercial coordination is rejected in both demo languages; civic access is allowed', () => {
  for (const input of ['Let us agree on prices.', 'We should divide the customers.', '我們應該聯合定價。', '我們可以瓜分市場。']) assert.throws(() => assertCivic(input), { status: 422 });
  assert.doesNotThrow(() => assertCivic('Keep the garage open until 6 pm and end music at 9 pm.'));
  const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
  assert.throws(() => recordDecision(room, { participant: 'tea', version: 1, status: 'revise', reviewed: true, note: 'Let us agree on prices.' }), { status: 422 });
  assert.equal(room.decisions.length, 0);
});
test('SQLite persists decisions across restarts and rejects lost updates', () => {
  const directory = mkdtempSync(join(tmpdir(), 'common-ground-store-')); const path = join(directory, 'room.sqlite');
  let store = createStore(path);
  try {
    const room = readyRoom(); addProposal(room, rehearsalProposal(), 'rehearsal', 'rehearsal');
    recordDecision(room, { participant: 'tea', version: 1, status: 'approved', reviewed: true }); store.save(room, 0);
    const first = store.read(), competing = store.read(); first.events.push({ type: 'one' }); store.save(first, first.revision);
    assert.throws(() => store.save(competing, competing.revision), { status: 409 });
    store.close(); store = createStore(path);
    assert.equal(publishView(store.read(), 'tea').approvals[0].status, 'approved');
    assert.equal(store.read().events.at(-1).type, 'one');
  } finally {
    store.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('common-ground-store-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
