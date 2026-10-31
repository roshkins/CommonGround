// Run explicitly on the Linux VM, once before and once after restarting the
// actor service. Uses isolated random private identities and no paid APIs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../lib/config.mjs';
import { createWorkspaceManager } from '../lib/workspaces.mjs';
import { rehearsalProposal } from '../lib/domain.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = () => readConfig(root);
assert.equal(config().workspaceStorage, 'terse', 'This smoke test must use the genuine actor runtime.');
const services = {
  status: () => ({}),
  understand: async input => ({ summary: input, goal: input, constraints: [], question: '', shareSuggestion: input, allowed: true }),
  negotiate: async () => ({ content: rehearsalProposal(), exchange: [] }),
};
const manager = createWorkspaceManager({ root, config, services });
const path = join(root, 'data', 'actor-smoke.json');
try {
  if (process.argv[2] === 'write') {
    const visitorId = `smoke-${randomUUID()}`;
    let view = await manager.execute(visitorId, 'understand', { participant: 'garage', text: 'Isolated runtime test: preserve delivery access.', language: 'en', mode: 'rehearsal' });
    view = await manager.execute(visitorId, 'share', { participant: 'garage', brief: 'Preserve delivery access.', draftId: view.self.draft.id, consent: true, transport: 'rehearsal', revision: view.revision });
    view = await manager.execute(visitorId, 'negotiate', { participant: 'garage', mode: 'rehearsal', transport: 'rehearsal', revision: view.revision });
    view = await manager.execute(visitorId, 'decision', { participant: 'garage', version: 1, reviewed: true, status: 'approved', revision: view.revision });
    assert.equal(view.allApproved, true);
    assert.equal(view.services.persistence, 'terse-runtime'); assert.equal(view.services.terse, 'verified');
    await writeFile(path, JSON.stringify({ visitorId, roomId: view.id, version: 1 }));
    console.log('PASS: genuine Terse participant and room actors wrote a private proposal, brief and exact-version decision. Restart the actor service, then run read.');
  } else if (process.argv[2] === 'read') {
    const expected = JSON.parse(await readFile(path, 'utf8'));
    const view = await manager.getView(expected.visitorId, 'garage');
    assert.equal(view.id, expected.roomId); assert.equal(view.proposal.version, expected.version); assert.equal(view.allApproved, true);
    assert.equal(view.self.draft.original, 'Isolated runtime test: preserve delivery access.');
    const other = await manager.getView(`smoke-${randomUUID()}`, 'garage');
    assert.equal(other.self.draft, null); assert.equal(other.proposal, null); assert.notEqual(other.id, view.id);
    console.log('PASS: genuine Terse state survived process restart, with private draft isolation and exact-version approval intact.');
  } else throw new Error('Use write or read.');
} finally { await manager.close(); }
