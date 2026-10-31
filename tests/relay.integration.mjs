import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { PEOPLE, createRoom, shareBrief } from '../lib/domain.mjs';
import { createServices } from '../lib/services.mjs';

const root = mkdtempSync(join(tmpdir(), 'common-ground-relay-'));
try {
  const room = createRoom();
  for (const p of PEOPLE) {
    room.participants[p.id].draft = { id: p.id, original: 'PRIVATE_DO_NOT_TRANSMIT', understanding: { allowed: true } };
    shareBrief(room, { participant: p.id, consent: true, brief: p.seed.en, draftId: p.id });
  }
  const services = createServices({ root, config: () => ({ relayUrl: 'http://127.0.0.1:8787', relayKey: '', openaiKey: '', model: 'unused' }) });
  const result = await services.negotiate(room, 'rehearsal', 'relaycast');
  assert.equal(result.exchange.length, 4);
  assert.ok(result.exchange.every(e => e.transport === 'relaycast' && e.verified === true));
  assert.ok(result.exchange.every(e => e.acknowledged === true && e.deliveryId));
  assert.equal(new Set(result.exchange.map(e => e.id)).size, 4);
  assert.equal(JSON.stringify(result.exchange).includes('PRIVATE_DO_NOT_TRANSMIT'), false);
  assert.equal(services.status().relay, 'verified');
  console.log('PASS: Four actual Relaycast DMs, each read back and durably acknowledged by its recipient; private raw concerns excluded.');
} finally {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  assert.ok(basename(root).startsWith('common-ground-relay-'));
  rmSync(root, { recursive: true, force: true });
}
