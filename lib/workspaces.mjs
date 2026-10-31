import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { PEOPLE, EVIDENCE, createRoom, person, language, text, assertCivic, addProposal, currentProposal, fail } from './domain.mjs';

const copy = value => structuredClone(value);
const now = () => new Date().toISOString();
const sharedId = 'shared-street-market';
const idPattern = /^[a-zA-Z0-9_-]{8,100}$/;
const cfgValue = config => typeof config === 'function' ? config() : config;
function validVisitor(id) { if (typeof id !== 'string' || !idPattern.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) fail(400, 'Invalid visitor session.'); return id; }
function newParticipant(id) { return { revision: 0, visitorId: id, displayName: `Neighbor ${id.slice(0, 5)}`, mode: 'private', privateRoomId: `private-${id}`, drafts: {}, sendIntents: {}, watch: {}, needs: '', phone: {}, createdAt: now() }; }
function newRoom(id, mode) { return { ...createRoom(), id, mode, contributors: {}, members: {}, run: null }; }

// Test adapter. It is selected explicitly and never substituted for an unavailable runtime.
export function createMemoryRecordAdapter() {
  const records = new Map();
  return {
    kind: 'memory-test-only',
    async read(type, id, initial) { const key = `${type}:${id}`; if (!records.has(key)) records.set(key, copy(initial)); return copy(records.get(key)); },
    async write(type, id, next, expected) { const key = `${type}:${id}`; if (records.get(key)?.revision !== expected) fail(409, 'The workspace changed. Refresh before saving.'); records.set(key, copy(next)); return copy(next); },
    close() {},
  };
}

async function sqliteAdapter(root) {
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(join(root, 'data'), { recursive: true });
  const db = new DatabaseSync(join(root, 'data', 'workspaces.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace_documents (kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))');
  return {
    kind: 'explicit-local-sqlite',
    async read(type, id, initial) { db.prepare('INSERT OR IGNORE INTO workspace_documents VALUES (?,?,?,?)').run(type, id, initial.revision, JSON.stringify(initial)); return JSON.parse(db.prepare('SELECT body FROM workspace_documents WHERE kind=? AND id=?').get(type, id).body); },
    async write(type, id, next, expected) { const result = db.prepare('UPDATE workspace_documents SET revision=?,body=? WHERE kind=? AND id=? AND revision=?').run(next.revision, JSON.stringify(next), type, id, expected); if (result.changes !== 1) fail(409, 'The workspace changed. Refresh before saving.'); return next; },
    close() { db.close(); },
  };
}

async function actorAdapter(config) {
  const c = cfgValue(config);
  if (!c.terseUrl) fail(503, 'Terse is not configured. Start the actor runtime and set TERSE_ACTOR_URL; local SQLite requires explicit WORKSPACE_STORAGE=sqlite.');
  let transport;
  try {
    const { createActorTransport } = await import('durable-actors/backend');
    const url = new URL(c.terseUrl);
    const match = url.pathname.match(/\/v1\/projects\/([^/]+)\/actors\/?$/);
    if (!match) fail(503, 'TERSE_ACTOR_URL must point to the private runtime /v1/projects/commonground/actors endpoint.');
    transport = createActorTransport({ controlPlaneUrl: url.origin, projectId: decodeURIComponent(match[1]), ...(c.terseKey ? { apiKey: c.terseKey } : {}) });
  } catch (error) { if (error.status) throw error; fail(503, 'The Terse actor SDK is unavailable. Install the pinned SDK; no SQLite fallback was used.'); }
  const invoke = async (type, id, method, args) => {
    try { return JSON.parse(await transport.invoke(type, id, method, args)); }
    catch (error) { if (/CG409|Workspace changed/.test(error.message)) fail(409, 'The workspace changed. Refresh before saving.'); fail(503, 'Terse could not confirm the actor operation. Refresh before retrying; no local fallback was used.'); }
  };
  return {
    kind: 'terse-runtime',
    read(type, id, initial) { return invoke(type, id, 'read', [JSON.stringify(initial)]); },
    write(type, id, next, expected) { return invoke(type, id, 'compareAndSet', [expected, JSON.stringify(next)]); },
    close() {},
  };
}

export function createWorkspaceManager({ root, config, services, progress = () => {}, recordAdapter } = {}) {
  let adapterPromise, verified = false;
  const adapter = () => adapterPromise ??= (async () => {
    if (recordAdapter) return recordAdapter;
    const c = cfgValue(config);
    if (c.workspaceStorage === 'memory') return createMemoryRecordAdapter();
    if (c.workspaceStorage === 'sqlite') return sqliteAdapter(root);
    return actorAdapter(config);
  })();
  async function read(type, id, initial) { const result = await (await adapter()).read(type, id, initial); verified = true; return result; }
  async function write(type, id, next, expected) { next.revision = expected + 1; return (await adapter()).write(type, id, next, expected); }
  const participant = id => read('ParticipantState', validVisitor(id), newParticipant(id));
  const roomId = p => p.mode === 'shared' ? sharedId : p.privateRoomId;
  const roomFor = p => read('NegotiationState', roomId(p), newRoom(roomId(p), p.mode));
  function checkRevision(room, input) { if (input.revision !== undefined && input.revision !== room.revision) fail(409, 'The workspace changed. Refresh before saving.'); }
  function event(room, type, detail = {}) { room.events.push({ id: randomUUID(), type, at: now(), ...detail }); }
  function stale(room) { const p = currentProposal(room); return Boolean(p && Object.entries(room.contributors).some(([id, c]) => p.contributorRevisions?.[id] !== c.shareRevision)); }
  function negotiationBasis(room) { return JSON.stringify({ contributors: Object.entries(room.contributors).sort(([a], [b]) => a.localeCompare(b)).map(([id, c]) => [id, c.shareRevision]), proposal: currentProposal(room)?.version || null, decisions: room.decisions }); }
  function decisionFor(room, id) { const p = currentProposal(room); const d = p && room.decisions.findLast(d => d.visitorId === id && d.version === p.version); return { participant: id, visitorId: id, status: stale(room) ? 'outdated' : d?.status || 'pending', note: d?.note || '', version: p?.version || null }; }
  function serviceRoom(room) {
    const result = copy(room);
    for (const p of PEOPLE) {
      const authorized = Object.values(room.contributors).filter(c => c.perspective === p.id);
      const authored = authorized.map(c => `${c.displayName} (reviewed authorized brief): ${c.brief}`).join('\n\n');
      // Missing perspectives are transparent scenario context, never owner consent.
      const context = `[FICTIONAL SCENARIO CONTEXT ONLY. No visitor has authorized this perspective or approved it.] ${p.seed.en}`;
      result.participants[p.id].shared = { text: authored || context, language: authorized[0]?.language || p.language, contextOnly: !authorized.length };
    }
    return result;
  }
  function publicView(p, room, perspective) {
    person(perspective);
    const ownDraft = p.drafts[room.id]?.[perspective] || null;
    const own = room.contributors[p.visitorId];
    const contributors = Object.values(room.contributors).map(c => ({ ...c, ...decisionFor(room, c.visitorId), id: c.visitorId }));
    const approvals = contributors.map(c => ({ participant: c.id, visitorId: c.id, displayName: c.displayName, perspective: c.perspective, status: c.status, note: c.note, version: c.version }));
    const proposal = currentProposal(room);
    return {
      id: room.id, revision: room.revision, participantRevision: p.revision, createdAt: room.createdAt,
      workspace: { id: room.id, mode: p.mode, visitorId: p.visitorId, displayName: p.displayName, isContributor: Boolean(own) },
      participants: PEOPLE.map(b => { const cs = contributors.filter(c => c.perspective === b.id); return { ...b, shared: cs.length ? { text: cs.map(c => `${c.displayName}: ${c.brief}`).join('\n\n'), revision: Math.max(...cs.map(c => c.shareRevision)) } : null, shareRevision: cs.reduce((n, c) => n + c.shareRevision, 0) }; }),
      self: { id: perspective, visitorId: p.visitorId, language: ownDraft?.language || person(perspective).language, draft: ownDraft, shared: own?.perspective === perspective ? { text: own.brief, language: own.language, revision: own.shareRevision } : null, shareRevision: own?.shareRevision || 0 },
      proposal, proposalStale: stale(room), approvals, contributors,
      allApproved: Boolean(proposal && !stale(room) && !proposal.translationPending && approvals.length && approvals.every(a => a.status === 'approved')),
      exchanges: room.exchanges.slice(-20), events: room.events.slice(-40), evidence: EVIDENCE,
      sharedContext: { observerCount: Object.values(room.members).filter(m => !room.contributors[m.visitorId]).length, contributorCount: contributors.length, history: room.events.slice(-40), notice: 'Fictional scenario. Only reviewed briefs are shared. Seeds have no votes. Prior visitor contributions and decisions remain in the shared history.' },
      services: { ...(services?.status?.() || {}), persistence: cfgValue(config).workspaceStorage === 'sqlite' ? 'explicit-local-sqlite' : cfgValue(config).workspaceStorage === 'memory' ? 'memory-test-only' : 'terse-runtime', terse: ['sqlite', 'memory'].includes(cfgValue(config).workspaceStorage) ? 'not-used-explicit-local-mode' : verified ? 'verified' : 'not_verified' },
    };
  }
  async function getView(visitorId, perspective = 'tea') { const p = await participant(visitorId); return publicView(p, await roomFor(p), perspective); }
  async function patchParticipant(visitorId, patch) {
    for (let i = 0; i < 5; i++) {
      const p = await participant(visitorId), expected = p.revision;
      for (const key of ['displayName', 'needs', 'watch', 'phone', 'alerts', 'call', 'phoneSession', 'conversation', 'pendingBrief']) if (Object.hasOwn(patch, key)) p[key] = key === 'phone' ? { ...(p.phone || {}), ...copy(patch.phone) } : copy(patch[key]);
      if (p.displayName !== undefined) p.displayName = text(p.displayName, 80);
      try { return await write('ParticipantState', visitorId, p, expected); } catch (error) { if (error.status !== 409 || i === 4) throw error; }
    }
  }
  async function saveRoom(room, expected) { return write('NegotiationState', room.id, room, expected); }
  async function execute(visitorId, action, input = {}) {
    let p = await participant(visitorId), room = await roomFor(p);
    const perspective = input.participant || input.perspective || 'tea'; person(perspective);
    checkRevision(room, input);
    if (action === 'join') {
      const shared = await read('NegotiationState', sharedId, newRoom(sharedId, 'shared'));
      if (!shared.members[visitorId]) { const expected = shared.revision; shared.members[visitorId] = { visitorId, displayName: p.displayName, joinedAt: now() }; event(shared, 'joined', { visitorId, displayName: p.displayName }); await saveRoom(shared, expected); }
      const expected = p.revision; p.mode = 'shared'; await write('ParticipantState', visitorId, p, expected);
      return getView(visitorId, perspective);
    }
    if (action === 'private') { const expected = p.revision; p.mode = 'private'; await write('ParticipantState', visitorId, p, expected); return getView(visitorId, perspective); }
    if (action === 'restart') {
      if (p.mode === 'shared') fail(403, 'The shared neighborhood history cannot be reset by a visitor. Return to your private workspace.');
      const expected = p.revision; p.privateRoomId = `private-${randomUUID()}`; await write('ParticipantState', visitorId, p, expected); return getView(visitorId, perspective);
    }
    if (action === 'understand' || action === 'offer') {
      const concern = text(input.text), lang = language(input.language || 'en'); assertCivic(concern);
      const mode = input.mode || 'live'; if (!['live', 'rehearsal'].includes(mode)) fail(400, 'Choose live or rehearsal.');
      // `offer` is an internal voice tool action, deliberately absent from the
      // public platform action allowlist. Preserve the caller-language brief
      // verbatim; never route it through an English-only understanding prompt.
      const understanding = action === 'offer' ? { summary: concern, goal: '', constraints: [], question: '', shareSuggestion: concern, allowed: true, exactOriginalLanguage: true } : await services.understand(concern, person(perspective), lang, mode);
      const expected = p.revision;
      p.drafts[room.id] ||= {};
      p.drafts[room.id][perspective] = { id: randomUUID(), original: concern, understanding, mode, language: lang, ...(input.spokenLanguage ? { spokenLanguage: String(input.spokenLanguage).slice(0, 30) } : {}), at: now() };
      await write('ParticipantState', visitorId, p, expected);
      return getView(visitorId, perspective);
    }
    if (action === 'share') {
      const draft = p.drafts[room.id]?.[perspective];
      if (!draft || draft.id !== input.draftId) fail(409, 'Review the current private understanding before sharing.');
      if (input.consent !== true) fail(400, 'Review and explicitly authorize the exact brief before sharing.');
      if (draft.understanding.allowed !== true) fail(422, 'This request cannot be shared.');
      const brief = text(input.brief, 3000); assertCivic(brief);
      if (draft.mode === 'live' && services.screenBrief) await services.screenBrief(brief);
      // Retries of the same reviewed words reuse one intent. A newly edited and
      // explicitly reviewed brief receives a different intent, even for one draft.
      const requestId = input.requestId || `share-${draft.id}-${perspective}-${createHash('sha256').update(brief).digest('hex').slice(0, 16)}`;
      if (typeof requestId !== 'string' || !/^[A-Za-z0-9._-]{1,180}$/.test(requestId) || ['__proto__', 'constructor', 'prototype'].includes(requestId)) fail(400, 'Invalid send intent.');
      const existing = p.sendIntents[requestId];
      if (existing && (existing.brief !== brief || existing.workspaceId !== room.id)) fail(409, 'The reviewed brief changed. Generate a fresh understanding before sending it.');
      if (!existing) {
        const expected = p.revision;
        p.sendIntents[requestId] = { requestId, workspaceId: room.id, visitorId, perspective, brief, language: draft.spokenLanguage || draft.language, uiLanguage: draft.language, transport: input.transport || 'relaycast', status: 'pending', createdAt: now() };
        await write('ParticipantState', visitorId, p, expected);
      }
      let intent = p.sendIntents[requestId];
      if (intent.status !== 'delivered') {
        if (intent.transport === 'rehearsal') intent = { ...intent, status: 'delivered', receipts: [], simulated: true };
        else {
          if (!services.shareAuthorizedBrief) fail(503, 'Reviewed brief is saved pending Relay dispatch. The send service is not ready.');
          const result = await services.shareAuthorizedBrief(intent);
          intent = { ...intent, status: 'delivered', receipts: Array.isArray(result) ? result : result.receipts || [], deliveredAt: now() };
        }
        p = await participant(visitorId); const expected = p.revision; p.sendIntents[requestId] = intent; await write('ParticipantState', visitorId, p, expected);
      }
      room = await roomFor(p);
      const previous = room.contributors[visitorId];
      if (previous?.intentId !== requestId) {
        const expected = room.revision;
        room.members[visitorId] ||= { visitorId, displayName: p.displayName, joinedAt: now() };
        room.contributors[visitorId] = { id: visitorId, visitorId, displayName: p.displayName, perspective, brief, language: draft.spokenLanguage || draft.language, uiLanguage: draft.language, shareRevision: (previous?.shareRevision || 0) + 1, joinedAt: room.members[visitorId].joinedAt, sharedAt: now(), intentId: requestId };
        room.exchanges.push(...intent.receipts);
        event(room, 'shared', { visitorId, displayName: p.displayName, perspective, simulated: Boolean(intent.simulated) });
        await saveRoom(room, expected);
      }
      return getView(visitorId, perspective);
    }
    if (action === 'negotiate' || action === 'revise') {
      if (!room.contributors[visitorId]) fail(403, 'Authorize your own brief before contributing to this negotiation.');
      if (room.run && room.run.expiresAt > Date.now()) fail(409, 'A negotiation is running. Please wait for the result.');
      const isRevision = action === 'revise';
      const previous = currentProposal(room);
      if (isRevision && (!previous || previous.version !== input.version || stale(room))) fail(409, 'Review the current proposal before revising.');
      const mode = input.mode || previous?.mode || 'live', transport = input.transport || previous?.transport || 'relaycast';
      if (!['live', 'rehearsal'].includes(mode) || !['relaycast', 'rehearsal'].includes(transport)) fail(400, 'Choose a supported AI mode and transport.');
      const revisionNote = isRevision ? text(input.note, 2000) : ''; if (revisionNote) assertCivic(revisionNote);
      const runId = randomUUID(), expected = room.revision;
      room.run = { id: runId, expiresAt: Date.now() + 12 * 60 * 1000, baseRevision: expected + 1 };
      await saveRoom(room, expected);
      const basis = negotiationBasis(room);
      try {
        progress({ stage: isRevision ? 'checking' : 'asking', workspaceId: room.id });
        const prepared = serviceRoom(room);
        let result;
        if (isRevision && mode === 'live') { const r = await services.reviseProposal(prepared, revisionNote); result = { content: r.proposal, exchange: [], critiqueIssues: r.issues }; }
        else if (isRevision) {
          const content = copy(previous.content);
          content.en.unresolved.push(`Requested amendment awaiting translation and reconciliation: ${revisionNote}`);
          content['zh-Hant'].unresolved.push(`待翻譯及協調的修訂要求（原文）：${revisionNote}`);
          result = { content, exchange: [], translationPending: true };
        } else result = await services.negotiate(prepared, mode, transport);
        const latest = await roomFor(p);
        if (negotiationBasis(latest) !== basis || latest.run?.id !== runId) fail(409, 'Someone added context while the advocates were working. No stale proposal was saved. Refresh and draft again.');
        const ready = serviceRoom(latest);
        addProposal(ready, result.content, mode, transport);
        const proposal = ready.proposals.at(-1);
        proposal.contributorRevisions = Object.fromEntries(Object.values(latest.contributors).map(c => [c.visitorId, c.shareRevision]));
        proposal.translationPending = Boolean(result.translationPending);
        proposal.critiqueIssues = result.critiqueIssues || [];
        latest.proposals.push(proposal); latest.exchanges.push(...(result.exchange || [])); latest.run = null;
        event(latest, 'proposal', { visitorId, version: proposal.version, kind: action });
        await saveRoom(latest, latest.revision);
      } finally {
        const latest = await roomFor(p);
        if (latest.run?.id === runId) { const expected = latest.revision; latest.run = null; await saveRoom(latest, expected); }
        progress({ stage: 'idle', workspaceId: room.id });
      }
      return getView(visitorId, perspective);
    }
    if (action === 'decision') {
      const proposal = currentProposal(room);
      if (!room.contributors[visitorId]) fail(403, 'Observers have no vote. Publish a reviewed brief to join as a contributor.');
      if (!proposal || proposal.version !== input.version || stale(room)) fail(409, 'This proposal changed. Review the current version.');
      if (input.reviewed !== true) fail(400, 'Confirm that you reviewed this exact proposal version.');
      if (!['approved', 'rejected', 'revise'].includes(input.status)) fail(400, 'Choose approve, reject, or request changes.');
      if (input.status === 'approved' && proposal.translationPending) fail(409, 'This amendment needs bilingual reconciliation before approval.');
      const note = typeof input.note === 'string' ? input.note.trim() : ''; if (note.length > 2000) fail(400, 'Decision note is too long.'); assertCivic(note);
      const expected = room.revision;
      room.decisions.push({ id: randomUUID(), participant: visitorId, visitorId, displayName: p.displayName, version: proposal.version, status: input.status, note, at: now(), actor: 'visitor-demo-operator' });
      event(room, 'decision', { visitorId, displayName: p.displayName, version: proposal.version, status: input.status });
      await saveRoom(room, expected); return getView(visitorId, perspective);
    }
    fail(404, 'Unknown workspace action.');
  }
  async function getPhoneDirectory() { return read('PhoneDirectoryState', 'pairing', { revision: 0, codes: {}, calls: {}, attempts: {} }); }
  async function updatePhoneDirectory(update) {
    for (let i = 0; i < 5; i++) {
      const value = await getPhoneDirectory(), expected = value.revision;
      const result = update(value);
      try { await write('PhoneDirectoryState', 'pairing', value, expected); return result; }
      catch (error) { if (error.status !== 409 || i === 4) throw error; }
    }
  }
  return { getView, execute, getParticipant: participant, patchParticipant, getPhoneDirectory, updatePhoneDirectory, status() { return { verified, storage: cfgValue(config).workspaceStorage || 'terse-runtime' }; }, async close() { if (adapterPromise) (await adapterPromise).close(); } };
}
