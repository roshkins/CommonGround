import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import twilio from 'twilio';
import { createPhoneService, createProactivePhoneConfig, phoneGreeting } from '../lib/phone.mjs';
import { createWorkspaceManager, createMemoryRecordAdapter } from '../lib/workspaces.mjs';

const VISITOR = 'phone-visitor-0001';
const CALL = `CA${'a'.repeat(32)}`;
const config = { workspaceStorage: 'memory', publicOrigin: 'https://demo.example', voiceOrigin: 'https://voice.example', twilioSid: `AC${'b'.repeat(32)}`, twilioToken: 'test-token', phoneNumber: '+14155551234', openaiKey: 'test-not-used' };
function setup(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cg-phone-test-'));
  const sent = [], redirects = [], caps = [], renders = [];
  const services = {
    status: () => ({}),
    understand: async input => ({ summary: input, goal: input, constraints: [], question: '', shareSuggestion: input, allowed: true }),
    shareAuthorizedBrief: async intent => { sent.push(intent); return { receipts: [{ id: intent.requestId, verified: true }] }; },
    synthesizeReview: async (text, language) => { renders.push({ text, language }); return Buffer.from('TEST-MP3'); },
    redirectInboundCall: async (callSid, url) => redirects.push({ callSid, url }),
    limitInboundCall: async (callSid, seconds) => caps.push({ callSid, seconds }),
    ...overrides.services,
  };
  const manager = createWorkspaceManager({ root, config, services, recordAdapter: createMemoryRecordAdapter() });
  const agendas = Object.hasOwn(overrides, 'agendas') ? overrides.agendas : { search: async ({ query, visitorId }) => { assert.equal(visitorId, VISITOR); return { results: [{ text: query, url: 'https://official.example/agenda' }] }; } };
  const phone = createPhoneService({ root, config, workspaces: manager, services, agendas });
  const cleanup = async () => { await manager.close(); const absolute = resolve(root); assert.ok(absolute.startsWith(resolve(tmpdir())) && absolute.includes('cg-phone-test-')); rmSync(absolute, { recursive: true, force: true }); };
  async function request(path, params = {}, valid = true) {
    const fields = { AccountSid: config.twilioSid, CallSid: CALL, To: config.phoneNumber, ...params };
    const req = Readable.from([new URLSearchParams(fields).toString()]); req.method = 'POST'; req.url = path;
    req.headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': valid ? twilio.getExpectedTwilioSignature(config.twilioToken, config.publicOrigin + path, fields) : 'invalid' };
    const result = {};
    const res = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
    await phone.handle(req, res, new URL(path, config.publicOrigin)); return result;
  }
  async function connect() { const pairing = await phone.pair(VISITOR, { participant: 'garage', language: 'en', spokenLanguage: 'en' }); const result = await request('/phone/pair-connect', { Digits: pairing.code }); assert.equal(result.status, 200); assert.ok(result.body.includes('Code accepted. Connecting your advocate.')); return phone.context(CALL); }
  async function prepare(context) { await phone.tool(context.callToken, 'prepare_review', { brief: 'Deliveries need vehicle access until six pm.' }); return (await manager.getParticipant(VISITOR)).phone.review; }
  return { root, phone, manager, request, connect, prepare, sent, redirects, caps, renders, cleanup };
}

test('inbound pairing is signed, one-use and bound to a private visitor; no number is called', async () => {
  const s = setup();
  try {
    const invalid = await s.request('/phone/incoming', {}, false); assert.equal(invalid.status, 403);
    const c = await s.connect(); assert.equal(c.visitorId, VISITOR); assert.equal(c.participant, 'garage');
    assert.equal(s.sent.length, 0); assert.equal(s.redirects.length, 0);
    assert.deepEqual(s.caps, [{ callSid: CALL, seconds: 480 }]);
    await assert.rejects(s.phone.context(`CA${'c'.repeat(32)}`), { status: 403 });
    await assert.rejects(s.phone.tool(c.callToken, 'authorize', {}), { status: 403 });
  } finally { await s.cleanup(); }
});

test('key one before completed playback cannot send; full playback then key one sends once', async () => {
  const s = setup();
  try {
    const c = await s.connect(), review = await s.prepare(c), query = `?token=${review.token}`;
    assert.deepEqual(review.audience.recipients.map(p => p.id), ['tea', 'craft']);
    assert.equal(s.sent.length, 0);
    const early = await s.request(`/phone/confirm${query}`, { Digits: '1' }); assert.equal(early.status, 409); assert.equal(s.sent.length, 0);
    const playing = await s.request(`/phone/review${query}`); assert.equal(playing.status, 200); assert.ok(playing.body.includes('<Play>')); assert.equal(playing.body.includes('<Gather'), false);
    assert.ok(s.renders[0].text.includes('Lantern Tea and Jade & Paper')); assert.ok(s.renders[0].text.includes('private demo workspace'));
    const armed = await s.request(`/phone/arm${query}`); assert.equal(armed.status, 200); assert.ok(armed.body.includes('<Gather'));
    const sent = await s.request(`/phone/confirm${query}`, { Digits: '1' }); assert.equal(sent.status, 200); assert.equal(s.sent.length, 1);
    assert.ok(sent.body.includes('only with the advocates in your private demo workspace'));
    assert.ok(sent.body.includes('proposal still needs human approval')); assert.ok(sent.body.includes('Nothing has been filed with government'));
    assert.equal(s.sent[0].brief, review.brief);
    await s.request(`/phone/confirm${query}`, { Digits: '1' }); assert.equal(s.sent.length, 1);
    assert.equal((await s.manager.getView(VISITOR, 'garage')).allApproved, false);
  } finally { await s.cleanup(); }
});

test('Albanian brief remains original, bypasses English rewriting, and gets Albanian audio controls', async () => {
  const s = setup({ services: { understand: async () => { throw new Error('English understanding must not be called for original-language review'); } } });
  try {
    const c = await s.connect();
    const original = 'Dyqani im ka nevojë për hyrje për dërgesat deri në orën gjashtë. Muzika të ndalet në orën nëntë.';
    const result = await s.phone.tool(c.callToken, 'prepare_review', { brief: original, spokenLanguage: 'sq' });
    assert.equal(result.status, 'review_started'); assert.equal(result.spokenLanguage, 'sq'); assert.equal(result.controlLanguage, 'sq');
    const p = await s.manager.getParticipant(VISITOR), v = await s.manager.getView(VISITOR, 'garage');
    assert.equal(p.phone.review.brief, original); assert.equal(v.self.draft.original, original); assert.equal(v.self.draft.understanding.shareSuggestion, original);
    assert.ok(s.renders[0].text.endsWith(original)); assert.equal(s.renders[0].language, 'sq'); assert.ok(s.renders[1].text.includes('Shtypni një'));
    assert.equal((await s.phone.context(CALL)).spokenLanguage, 'sq'); assert.equal(s.sent.length, 0);
    const token = `?token=${p.phone.review.token}`;
    await s.request(`/phone/review${token}`); await s.request(`/phone/arm${token}`); await s.request(`/phone/confirm${token}`, { Digits: '1' });
    assert.equal(s.sent[0].brief, original); assert.equal(s.sent[0].language, 'sq'); assert.equal(s.sent[0].uiLanguage, 'en');
  } finally { await s.cleanup(); }
});

test('missing agenda service and failed audio preparation return explicit usable tool feedback', async () => {
  const s = setup({ agendas: null, services: { synthesizeReview: async () => { throw new Error('Unavailable audio provider'); } } });
  try {
    const c = await s.connect();
    const search = await s.phone.tool(c.callToken, 'agenda_search', { query: 'Access needs' });
    assert.equal(search.status, 'unavailable'); assert.ok(search.message.includes('caller language'));
    const review = await s.phone.tool(c.callToken, 'prepare_review', { brief: 'Keep access open.', spokenLanguage: 'en' });
    assert.equal(review.status, 'review_unavailable'); assert.ok(review.message.includes('Nothing was sent'));
    assert.equal(s.sent.length, 0); assert.equal(s.redirects.length, 0);
  } finally { await s.cleanup(); }
});

test('timeout, revise, replay and changed draft cannot accidentally authorize a brief', async () => {
  const s = setup();
  try {
    const c = await s.connect(); let review = await s.prepare(c), query = `?token=${review.token}`;
    await s.request(`/phone/review${query}`); await s.request(`/phone/arm${query}`);
    await s.request(`/phone/confirm${query}`, { Digits: '' }); assert.equal(s.sent.length, 0);
    review = await s.prepare(c); query = `?token=${review.token}`;
    await s.request(`/phone/review${query}`); await s.request(`/phone/arm${query}`);
    await s.request(`/phone/confirm${query}`, { Digits: '9' }); assert.equal(s.sent.length, 0);
    await s.request(`/phone/review${query}`); await s.request(`/phone/arm${query}`);
    await s.request(`/phone/confirm${query}`, { Digits: '2' }); assert.equal(s.sent.length, 0);
    review = await s.prepare(c); query = `?token=${review.token}`;
    await s.request(`/phone/review${query}`); await s.request(`/phone/arm${query}`);
    await s.manager.execute(VISITOR, 'understand', { participant: 'garage', text: 'My conditions changed.', language: 'en', mode: 'live' });
    const stale = await s.request(`/phone/confirm${query}`, { Digits: '1' }); assert.equal(stale.status, 409); assert.equal(s.sent.length, 0);
  } finally { await s.cleanup(); }
});

test('call transcripts and agenda tools remain private and call capabilities expire', async () => {
  const s = setup();
  try {
    const c = await s.connect();
    const found = await s.phone.tool(c.callToken, 'agenda_search', { query: 'Vehicle access' }); assert.equal(found.results.length, 1);
    const review = await s.prepare(c);
    await s.phone.recordTranscript(CALL, [{ role: 'user', text: 'PRIVATE CALL CONTENT' }]);
    assert.equal((await s.phone.context(CALL)).conversation[0].text, 'PRIVATE CALL CONTENT');
    assert.equal((await s.manager.getParticipant(VISITOR)).phone.review.id, review.id);
    assert.equal(JSON.stringify(await s.manager.getView('different-visitor-0002')).includes('PRIVATE CALL CONTENT'), false);
    await s.manager.updatePhoneDirectory(d => { d.calls[CALL].expiresAt = Date.now() - 1; });
    await assert.rejects(s.phone.tool(c.callToken, 'prepare_review', { brief: 'Do not send.' }), { status: 403 });
  } finally { await s.cleanup(); }
});

test('private agenda context is preloaded from saved needs and citations, not caller prompting', async () => {
  const queries = [];
  const s = setup({ agendas: { getWatch: () => ({ needs: 'Accessible storefront', streets: ['Grant Avenue'] }), search: async args => { queries.push(args); return { mode: 'supabase-vector', results: [{ title: 'Official access item', text: 'Keep the route accessible.', url: 'https://official.example/agenda#page=2', page: 2, item: '4', meetingDate: '2026-11-12' }] }; } } });
  try {
    const context = await s.connect();
    assert.ok(queries[0].query.includes('Accessible storefront')); assert.ok(queries[0].query.includes('Grant Avenue'));
    assert.equal(context.agendaContext.mode, 'supabase-vector'); assert.equal(context.agendaContext.results[0].page, 2);
    await s.phone.context(CALL); assert.equal(queries.length, 1);
    assert.equal(s.sent.length, 0);
  } finally { await s.cleanup(); }
});

test('agenda refresh supplies factual thinking context without forcing speech during transcript fragments', async () => {
  class BaseProvider { constructor() { this.events = []; } async dispatchModelEvent() {} modelSend(id, event) { this.events.push({ id, event }); } }
  class BaseConfig {}
  let refreshes = 0;
  const Config = createProactivePhoneConfig(BaseProvider, BaseConfig, async () => { refreshes++; return { mode: 'supabase-vector', status: { meetings: Array(100).fill({ large: 'UNBOUNDED-STATUS'.repeat(100) }) }, results: [{ title: 'Cited agenda', text: '已核實的通道資料'.repeat(100), url: 'https://official.example/agenda', page: 2 }] }; });
  const provider = new Config().createProvider({}, {});
  const session = { metadata: { transcript: [{ role: 'user', text: 'Please speak Albanian' }, { role: 'user', text: 'My shop needs accessible deliveries.' }] } };
  await provider.dispatchModelEvent(CALL, session, { type: 'session.output_transcript.delta' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(provider.events.length, 1);
  assert.equal(provider.events[0].event.type, 'session.thinking.append');
  assert.equal(JSON.parse(provider.events[0].event.content).results[0].page, 2);
  assert.equal(JSON.parse(provider.events[0].event.content).status, 'matches');
  assert.ok(provider.events[0].event.content.length <= 1500);
  assert.ok(/^[\x20-\x7e]*$/.test(provider.events[0].event.content));
  assert.equal(provider.events[0].event.content.includes('UNBOUNDED-STATUS'), false);
  assert.equal(refreshes, 1);
  session.metadata.transcript.push({ role: 'assistant', text: 'Understood.' }, { role: 'user', text: 'Customers also need to reach the door.' });
  await provider.dispatchModelEvent(CALL, session, { type: 'session.output_transcript.delta' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(provider.events.some(x => ['session.commentary.append', 'session.instructions.append'].includes(x.event.type)), false);
  assert.equal(refreshes, 1); const eventCount = provider.events.length;
  await provider.dispatchModelEvent(CALL, session, { type: 'session.output_transcript.delta' });
  assert.equal(provider.events.length, eventCount);
});

test('pending agenda retrieval cannot block paired-call context or the code-accepted greeting', async () => {
  let resolveSearch;
  const pending = new Promise(resolve => { resolveSearch = resolve; });
  const s = setup({ agendas: { search: () => pending } });
  try {
    const context = await Promise.race([s.connect(), new Promise((_, reject) => setTimeout(() => reject(new Error('Retrieval blocked voice startup')), 500))]);
    assert.equal(context.agendaContext.status, 'loading');
    resolveSearch({ results: [] });
  } finally { resolveSearch({ results: [] }); await s.cleanup(); }
});

test('real GPTLive provider factory forwards session.started into an immediate welcome', async () => {
  const { GPTLiveProvider, GPTLiveProviderConfig, TACConfig } = await import('twilio-agent-connect');
  const Config = createProactivePhoneConfig(GPTLiveProvider, GPTLiveProviderConfig);
  const provider = new Config({ openaiApiKey: 'offline-not-used', welcomeInstruction: 'Greet the paired caller immediately.' }).createProvider({ getLoggerInternal: () => ({ info() {}, warn() {}, error() {} }), getConversationSession: () => null }, new TACConfig({ accountSid: config.twilioSid, authToken: config.twilioToken, apiKey: `SK${'c'.repeat(32)}`, apiSecret: 'offline-not-used', phoneNumber: config.phoneNumber, voicePublicDomain: 'voice.example' }));
  const events = [];
  provider.modelSend = (id, event) => events.push(event);
  try {
    await provider.dispatchModelEvent(CALL, { metadata: {} }, { type: 'session.started' });
    assert.equal(events[0].type, 'session.commentary.append');
    assert.equal(events[0].content, 'Greet the paired caller immediately.');
  } finally { provider.shutdown(); }
});

test('code-first flow shows the phone language fallback only after pairing an unknown language', async () => {
  for (const [digit, expected] of [['1', 'en'], ['2', 'yue'], ['3', 'sq'], ['0', 'auto']]) {
    const s = setup();
    try {
      const pairing = await s.phone.pair(VISITOR, { participant: 'garage', language: 'zh-Hant', spokenLanguage: 'auto' });
      const incoming = await s.request('/phone/incoming'); assert.ok(incoming.body.includes('numDigits="6"')); assert.ok(incoming.body.includes('/phone/pair-connect')); assert.equal(incoming.body.includes('language-menu'), false);
      const unpaired = await s.request('/phone/language', { Digits: digit }); assert.equal(unpaired.status, 403);
      const menu = await s.request('/phone/pair-connect', { Digits: pairing.code }); assert.ok(menu.body.includes('language-menu'));
      const choice = await s.request('/phone/language', { Digits: digit }); assert.equal(choice.status, 200);
      const context = await s.phone.context(CALL);
      assert.equal(context.language, 'zh-Hant'); assert.equal(context.spokenLanguage, expected);
      if (expected === 'sq') assert.ok(choice.body.includes('sq-connected'));
      if (expected === 'yue') assert.ok(choice.body.includes('配對碼正確'));
      if (expected === 'auto') assert.ok(choice.body.includes('auto-connected'));
      assert.equal(s.sent.length, 0);
    } finally { await s.cleanup(); }
  }
});

test('no explicit phone selection preserves the browser spoken-language preset without old call history', async () => {
  const s = setup();
  try {
    await s.manager.patchParticipant(VISITOR, { phone: { spokenLanguage: 'en', review: { callSid: `CA${'e'.repeat(32)}`, spokenLanguage: 'en', status: 'armed' } } });
    const pairing = await s.phone.pair(VISITOR, { participant: 'garage', language: 'en', spokenLanguage: 'sq' });
    const connected = await s.request('/phone/pair-connect', { Digits: pairing.code });
    assert.equal(connected.body.includes('language-menu'), false); assert.ok(connected.body.includes('sq-connected'));
    const context = await s.phone.context(CALL);
    assert.equal(context.spokenLanguage, 'sq'); assert.equal(context.reviewStatus, null);
    assert.ok(phoneGreeting('sq').includes('Albanian')); assert.ok(phoneGreeting('auto').includes('Listen'));
    await assert.rejects(s.phone.pair(VISITOR, { spokenLanguage: 'invalid' }), { status: 400 });
  } finally { await s.cleanup(); }
});

test('actual session and first audio lifecycle events are emitted once, without frame payloads', async () => {
  class Provider { async dispatchModelEvent() {} modelSend() {} }
  class Config {}
  const events = [];
  const Proactive = createProactivePhoneConfig(Provider, Config, undefined, async (id, session, event) => events.push(event));
  const provider = new Proactive().createProvider({}, {}), session = { metadata: {} };
  await provider.dispatchModelEvent(CALL, session, { type: 'session.started' });
  await provider.dispatchModelEvent(CALL, session, { type: 'session.output_audio.delta', delta: 'not-logged' });
  await provider.dispatchModelEvent(CALL, session, { type: 'session.output_audio.delta', delta: 'not-logged' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['live-session-started', 'live-first-audio']);
});

test('audio diagnostics count received and forwarded frames without retaining audio or identities', async t => {
  const { EventEmitter } = await import('node:events');
  const lines = []; t.mock.method(console, 'log', line => lines.push(JSON.parse(line)));
  class Provider {
    handleWebSocket(ws) { ws.on('message', raw => { const event = JSON.parse(raw); if (event.event === 'media') this.modelSend(CALL, { type: 'session.input_audio.append', audio: event.media.payload }); }); }
    modelSend() {}
    async dispatchModelEvent() {}
  }
  class Config {}
  const Configured = createProactivePhoneConfig(Provider, Config), provider = new Configured().createProvider({}, {}), ws = new EventEmitter();
  provider.handleWebSocket(ws);
  ws.emit('message', JSON.stringify({ event: 'start', start: { callSid: CALL } }));
  for (const byte of [255, 0]) ws.emit('message', JSON.stringify({ event: 'media', media: { payload: Buffer.alloc(160, byte).toString('base64') } }));
  await provider.dispatchModelEvent(CALL, { metadata: {} }, { type: 'session.input_transcript.delta' });
  ws.emit('close');
  assert.equal(lines.length, 1); assert.equal(lines[0].receivedFrames, 2); assert.equal(lines[0].forwardAttempts, 2); assert.equal(lines[0].nonquietFrames, 1); assert.equal(lines[0].userTranscriptDeltas, 1);
  assert.equal(JSON.stringify(lines).includes(CALL), false); assert.equal('audio' in lines[0], false); assert.equal(provider.phoneAudioStats.size, 0);
});

test('HTTP GET serves only whitelisted generic prompts and a valid listening chime', async () => {
  const s = setup();
  const directory = join(s.root, 'public', 'phone-prompts'); mkdirSync(directory, { recursive: true });
  const audio = Buffer.from('ID3isolated-prompt-fixture'); writeFileSync(join(directory, 'sq-code.mp3'), audio);
  const server = createServer((req, res) => { void s.phone.handle(req, res, new URL(req.url, config.publicOrigin)); });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prompt = await fetch(`${origin}/phone/prompt?name=sq-code`);
    assert.equal(prompt.status, 200); assert.ok(prompt.headers.get('content-type').includes('audio/mpeg'));
    assert.deepEqual(Buffer.from(await prompt.arrayBuffer()), audio);
    const chime = await fetch(`${origin}/phone/prompt?name=auto-connected`);
    assert.equal(chime.status, 200); assert.equal(Buffer.from(await chime.arrayBuffer()).subarray(0, 4).toString(), 'RIFF');
    const forbidden = await fetch(`${origin}/phone/prompt?name=../../.env`); assert.equal(forbidden.status, 404); await forbidden.text();
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await s.cleanup(); }
});

test('real synthesis branch uses the speech HTTP API without the synthesis shortcut or route variables', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return new Response(Buffer.from('ID3isolated-audio'), { status: 200 }); });
  const s = setup({ services: { synthesizeReview: undefined } });
  try {
    const context = await s.connect();
    const result = await s.phone.tool(context.callToken, 'prepare_review', { brief: 'Dërgesat kanë nevojë për hyrje deri në gjashtë.', spokenLanguage: 'sq' });
    assert.equal(result.status, 'review_started'); assert.equal(requests.length, 3);
    assert.ok(requests.every(r => r.url === 'https://api.openai.com/v1/audio/speech'));
    assert.ok(requests.every(r => r.body.instructions.includes('sq')));
    assert.equal(s.sent.length, 0); assert.equal(s.redirects.length, 1);
  } finally { await s.cleanup(); }
});
