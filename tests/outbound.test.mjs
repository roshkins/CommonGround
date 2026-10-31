import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import twilio from 'twilio';
import { createNotificationStore } from '../lib/notifications.mjs';
import { createPhoneService, phoneGreeting, phoneNotificationText } from '../lib/phone.mjs';
import { createWorkspaceManager, createMemoryRecordAdapter } from '../lib/workspaces.mjs';
import { createActivityTrace } from '../lib/activity.mjs';

const VISITOR = 'outbound-owner-a', OTHER = 'outbound-owner-b';
const INBOUND = `CA${'a'.repeat(32)}`, OUTBOUND = `CA${'c'.repeat(32)}`;
const OWN = '+14155550001';
const config = { workspaceStorage: 'memory', publicOrigin: 'https://demo.example', voiceOrigin: 'https://voice.example', twilioSid: `AC${'b'.repeat(32)}`, twilioToken: 'isolated-token', phoneNumber: '+14155551234', openaiKey: 'never-used' };
const chunk = n => ({ id: `item-${n}`, title: 'Grant Avenue access update', text: `Delivery access and street closure notice revision ${n}.`, body: 'ISCOTT', meetingDate: '2027-01-01', url: 'https://www.sfmta.com/meetings', page: 3, item: 'C', contentHash: `hash-${n}` });
function store(db = new DatabaseSync(':memory:'), now = () => Date.now()) { return createNotificationStore({ db, now }); }
function enable(n, id = VISITOR) { n.saveWatch(id, { needs: 'delivery access', streets: ['Grant Avenue'] }); n.saveCallPreference(id, { enabled: true, phoneNumber: OWN, language: 'en', participant: 'garage', verifiedAt: new Date().toISOString(), consentAt: new Date().toISOString() }); }
function setup(activity) {
  const root = mkdtempSync(join(tmpdir(), 'cg-outbound-test-')), db = new DatabaseSync(':memory:');
  const agendas = Object.assign(store(db), { search: async () => ({ results: [] }) });
  const created = [];
  const services = { status: () => ({}), limitInboundCall: async () => {}, createOutboundCall: async options => { created.push(options); return { sid: OUTBOUND }; } };
  const workspaces = createWorkspaceManager({ root, config, services, recordAdapter: createMemoryRecordAdapter() });
  const phone = createPhoneService({ root, config, workspaces, agendas, services, activity });
  async function request(path, params = {}, signed = true) {
    const fields = { AccountSid: config.twilioSid, CallSid: INBOUND, To: config.phoneNumber, From: OWN, ...params };
    const req = Readable.from([new URLSearchParams(fields).toString()]); req.method = 'POST'; req.url = path;
    req.headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signed ? twilio.getExpectedTwilioSignature(config.twilioToken, config.publicOrigin + path, fields) : 'invalid' };
    const result = {}, res = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
    await phone.handle(req, res, new URL(path, config.publicOrigin)); return result;
  }
  async function pairInbound() { const code = await phone.pair(VISITOR, { participant: 'garage', language: 'en', spokenLanguage: 'en' }); assert.equal((await request('/phone/pair-connect', { Digits: code.code })).status, 200); }
  async function queue() {
    enable(agendas); agendas.ingest([chunk(1)]);
    await agendas.flushAgendaCalls(intent => phone.createAgendaCall(intent));
    return new URL(created[0].url).searchParams.get('token');
  }
  async function cleanup() { await workspaces.close(); db.close(); assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(basename(root).startsWith('cg-outbound-test-')); rmSync(root, { recursive: true, force: true }); }
  return { db, agendas, phone, workspaces, request, pairInbound, queue, created, cleanup };
}

test('outbound is default off and requires explicit own-number consent plus recent paired inbound binding', async () => {
  const s = setup();
  try {
    assert.equal((await s.phone.outboundPreferences(VISITOR)).enabled, false);
    await assert.rejects(s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber: OWN, language: 'en', consent: true }), { status: 403 });
    await s.pairInbound();
    await assert.rejects(s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber: OWN, language: 'en' }), { status: 400 });
    await assert.rejects(s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber: '+14155550002', language: 'en', consent: true }), { status: 403 });
    const pref = await s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber: OWN, language: 'en', consent: true });
    assert.equal(pref.enabled, true); assert.equal(pref.verifiedBy, 'paired-inbound-call'); assert.equal(JSON.stringify(pref).includes(OWN), false);
    assert.equal(s.created.length, 0);
  } finally { await s.cleanup(); }
});

test('own-number formatting accepts optional plus and US local digits without weakening the exact binding', async () => {
  const s = setup();
  try {
    await s.pairInbound();
    for (const phoneNumber of [OWN, '14155550001', '(415) 555-0001', '+1 (415) 555-0001']) {
      const result = await s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber, language: 'en', consent: true });
      assert.equal(result.enabled, true); assert.equal(s.agendas.getCallPreference(VISITOR).phoneNumber, OWN);
    }
    for (const phoneNumber of ['', 'abc', '++14155550001', '123']) await assert.rejects(s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber, language: 'en', consent: true }), { status: 400 });
    for (const phoneNumber of ['4155550002', '4414155550001']) await assert.rejects(s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber, language: 'en', consent: true }), { status: 403 });
    assert.equal(s.created.length, 0);
  } finally { await s.cleanup(); }
});

test('only new relevant alerts after opt-in dispatch once; baseline, duplicates and daily excess do not call', async () => {
  const db = new DatabaseSync(':memory:'), n = store(db), calls = [];
  try {
    n.saveWatch(VISITOR, { needs: 'delivery access', streets: ['Grant Avenue'] });
    n.ingest([chunk(1)]); await n.flushAgendaCalls(async i => calls.push(i)); assert.equal(calls.length, 0);
    enable(n); n.ingest([chunk(1)]); n.ingest([chunk(2)], { baseline: true });
    await n.flushAgendaCalls(async i => calls.push(i)); assert.equal(calls.length, 0);
    n.ingest([chunk(3)]); n.ingest([chunk(3)]);
    await n.flushAgendaCalls(async i => { calls.push(i); return { sid: OUTBOUND }; });
    await n.flushAgendaCalls(async i => { calls.push(i); return { sid: OUTBOUND }; });
    n.ingest([chunk(4)]); await n.flushAgendaCalls(async i => calls.push(i));
    assert.equal(calls.length, 1); assert.equal(n.getCallIntent(calls[0].token).status, 'queued');
  } finally { db.close(); }
});

test('ambiguous Twilio create persists unknown and is never blindly retried after reopening the database', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cg-outbound-test-')), path = join(root, 'outbound.sqlite');
  let db = new DatabaseSync(path), n = store(db), attempts = 0;
  try {
    enable(n); n.ingest([chunk(1)]);
    const result = await n.flushAgendaCalls(async () => { attempts++; throw new Error('Timeout after provider may have accepted'); });
    assert.equal(result.unknown, 1); db.close(); db = new DatabaseSync(path); n = store(db);
    await n.flushAgendaCalls(async () => { attempts++; return { sid: OUTBOUND }; }); assert.equal(attempts, 1);
  } finally { db.close(); assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(basename(root).startsWith('cg-outbound-test-')); rmSync(root, { recursive: true, force: true }); }
});

test('outbound generic notice reveals no private history and binds only its intended workspace after a fresh code', async () => {
  const s = setup();
  try {
    await s.pairInbound(); await s.workspaces.patchParticipant(VISITOR, { phone: { conversation: [{ role: 'user', text: 'PRIVATE_OWNER_HISTORY_MARKER' }] } });
    const token = await s.queue();
    assert.equal(s.created[0].timeLimit, 120); assert.deepEqual(s.created[0].statusCallbackEvent, ['initiated','ringing','answered','completed']);
    const fields = { CallSid: OUTBOUND, To: OWN, From: config.phoneNumber };
    const wrong = await s.request(`/phone/outbound?token=${token}`, fields, false); assert.equal(wrong.status, 403);
    const notice = await s.request(`/phone/outbound?token=${token}`, fields); assert.equal(notice.status, 200); assert.ok(notice.body.includes('public agenda update')); assert.equal(notice.body.includes('PRIVATE_OWNER'), false);
    await assert.rejects(s.phone.context(OUTBOUND), { status: 403 });
    const other = await s.phone.pair(OTHER, { participant: 'tea', spokenLanguage: 'en' });
    const refused = await s.request(`/phone/pair-connect?outbound=${token}`, { ...fields, Digits: other.code }); assert.ok(refused.body.includes('invalid or expired')); await assert.rejects(s.phone.context(OUTBOUND), { status: 403 });
    const own = await s.phone.pair(VISITOR, { participant: 'garage', spokenLanguage: 'en' });
    await s.request(`/phone/outbound-confirm?token=${token}`, { ...fields, Digits: '1' });
    const paired = await s.request(`/phone/pair-connect?outbound=${token}`, { ...fields, Digits: own.code }); assert.equal(paired.status, 200);
    assert.ok(paired.body.includes('Code accepted. Connecting your advocate.'));
    assert.equal(paired.body.includes(chunk(1).title), false); // No long source playback before the microphone stream.
    const context = await s.phone.context(OUTBOUND);
    assert.equal(context.visitorId, VISITOR);
    assert.equal(context.triggeringAgenda.page, 3); assert.equal(context.triggeringAgenda.item, 'C');
    assert.equal(context.triggeringAgenda.meetingDate, chunk(1).meetingDate);
    assert.equal(context.triggeringAgenda.text, chunk(1).text);
    assert.equal(context.agendaContext.mode, 'triggering-agenda-alert');
    const greeting = phoneGreeting('en', context.triggeringAgenda);
    assert.ok(greeting.includes(context.triggeringAgenda.title)); assert.ok(greeting.includes(context.triggeringAgenda.meetingDate));
    assert.equal(greeting.includes('Tell me your business concern'), false);
  } finally { await s.cleanup(); }
});

test('answerer can stop future calls without exposing private state; wrong recipient cannot use webhook', async () => {
  const s = setup();
  try {
    const token = await s.queue();
    const wrong = await s.request(`/phone/outbound?token=${token}`, { CallSid: OUTBOUND, To: '+14155559999', From: config.phoneNumber }); assert.equal(wrong.status, 403);
    const stopped = await s.request(`/phone/outbound-confirm?token=${token}`, { CallSid: OUTBOUND, To: OWN, From: config.phoneNumber, Digits: '9' });
    assert.equal(stopped.status, 200); assert.equal(s.agendas.getCallPreference(VISITOR).enabled, false);
    s.agendas.ingest([chunk(2)]); await s.agendas.flushAgendaCalls(i => s.phone.createAgendaCall(i)); assert.equal(s.created.length, 1);
  } finally { await s.cleanup(); }
});

test('explicit labeled test uses only the opted-in own recipient and an existing cited source; active retries are blocked', async () => {
  const activity = createActivityTrace(), s = setup(activity);
  try {
    await assert.rejects(s.phone.testAgendaCall(VISITOR, {}), { status: 400 });
    await s.pairInbound();
    await s.phone.saveOutboundPreferences(VISITOR, { enabled: true, phoneNumber: OWN, language: 'en', consent: true });
    s.agendas.search = async () => ({ results: [{ ...chunk(1), meetingDate: '2026-10-22', title: 'Existing Winter Walk minutes' }] });
    const result = await s.phone.testAgendaCall(VISITOR, { confirmTest: true, phoneNumber: '+14155559999' });
    assert.equal(result.test, true); assert.equal(result.status, 'requested'); assert.equal(s.created.length, 1); assert.equal(s.created[0].to, OWN);
    assert.match(result.code, /^\d{6}$/); assert.ok(Date.parse(result.expiresAt) > Date.now());
    const operations = activity.read(VISITOR);
    assert.ok(operations.some(x => x.service === 'twilio' && x.operation === 'Request opted-in agenda call' && x.status === 'succeeded'));
    assert.equal(JSON.stringify(operations).includes(OWN), false); assert.equal(JSON.stringify(operations).includes(OUTBOUND), false);
    const token = new URL(s.created[0].url).searchParams.get('token');
    const intent = s.agendas.getCallIntent(token); assert.equal(intent.test, true);
    const alert = s.agendas.getAlert(VISITOR, intent.alertId); assert.equal(alert.test, true); assert.ok(alert.reason.includes('not a new publication'));
    assert.equal(s.agendas.getAlert(OTHER, intent.alertId), null);
    const notice = await s.request(`/phone/outbound?token=${token}`, { CallSid: OUTBOUND, From: config.phoneNumber, To: OWN });
    assert.ok(notice.body.includes('TEST agenda notification')); assert.ok(notice.body.includes('not a new publication'));
    await assert.rejects(s.phone.testAgendaCall(VISITOR, { confirmTest: true }), { status: 409 });
    assert.equal(s.created.length, 1);
    await s.request(`/phone/pair-connect?outbound=${token}`, { CallSid: OUTBOUND, From: config.phoneNumber, To: OWN, Digits: result.code });
    const context = await s.phone.context(OUTBOUND); assert.equal(context.triggeringAgenda.test, true); assert.ok(context.triggeringAgenda.notice.includes('not a newly published agenda'));
  } finally { await s.cleanup(); }
});

test('manual test retry requires a terminal call and new confirmation, caps at three per hour, and never retries unknown', async () => {
  const db = new DatabaseSync(':memory:'), n = store(db);
  try {
    enable(n); const source = chunk(1);
    for (let i = 0; i < 3; i++) {
      const intent = n.queueCallTest(VISITOR, source);
      assert.throws(() => n.queueCallTest(VISITOR, source), { status: i === 2 ? 429 : 409 });
      await n.flushAgendaCalls(async () => ({ sid: `CA${String(i + 1).repeat(32)}` }), { visitorId: VISITOR });
      n.updateCallIntent(intent.token, `CA${String(i + 1).repeat(32)}`, 'completed');
    }
    assert.equal(n.callTestState(VISITOR).testsLastHour, 3); assert.throws(() => n.queueCallTest(VISITOR, source), { status: 429 });
  } finally { db.close(); }
  const db2 = new DatabaseSync(':memory:'), n2 = store(db2);
  try {
    enable(n2); n2.queueCallTest(VISITOR, chunk(1)); await n2.flushAgendaCalls(async () => { throw new Error('Ambiguous'); });
    assert.throws(() => n2.queueCallTest(VISITOR, chunk(1)), { status: 409 });
    const test = { ...chunk(1), test: true };
    assert.ok(phoneNotificationText(test, 'en').includes('existing document, not a new publication'));
    assert.ok(phoneNotificationText(test, 'yue').includes('項目 C')); assert.ok(phoneNotificationText(test, 'sq').includes('pika C'));
  } finally { db2.close(); }
});
