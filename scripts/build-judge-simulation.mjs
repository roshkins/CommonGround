import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { RelayCast } from '@relaycast/sdk';
import { readConfig } from '../lib/config.mjs';

// Explicit generation command: four bounded model calls, no phone calls, no
// application room/actor writes. Playback of the resulting fixture is static.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = {
  title: 'SFMTA ISCOTT minutes — October 22, 2026 — Winter Walk',
  url: 'https://www.sfmta.com/media/50353/download?inline#page=3',
  meetingDate: '2026-10-22', page: 3, item: 'C',
  text: 'The October 22, 2026 ISCOTT minutes list Winter Walk closures on Grant Avenue between Geary and Post and on Maiden Lane between Kearny and Stockton, including their intersection. Item C records December 4 at 6 a.m. through December 30 at 6 p.m., 2026, and an approval vote. These are source facts; the fictional pilot terms below are not official permit conditions.',
};
source.excerpt = source.text;
const brief = 'FICTIONAL DEMO: Harbor Lane Garage needs legally available delivery access protected until 6 p.m. and a clear step-free route. Saffron Kettle Tea wants discoverable evening foot traffic. Explore an after-6 pilot only if organizers and the city can approve the access plan; never assume an exemption from the recorded closure.';
const basic = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };
const finalSchema = { type: 'object', properties: { text: { type: 'string' }, terms: { type: 'array', items: { type: 'string' } }, tradeoffs: { type: 'array', items: { type: 'string' } }, unresolved: { type: 'array', items: { type: 'string' } } }, required: ['text', 'terms', 'tradeoffs', 'unresolved'], additionalProperties: false };

async function build() {
  const c = readConfig(root);
  if (!c.openaiKey) throw new Error('OpenAI server configuration is required; no simulation was generated.');
  const started = Date.now();
  const messages = [];
  const calls = [];
  let transport = null;
  const relayProof = { used: false, isolated: true, receipts: [], status: 'not-used' };
  try {
    const u = new URL(c.relayUrl);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('Only an isolated local Relay workspace is allowed.');
    await fetch(c.relayUrl, { signal: AbortSignal.timeout(800) });
    const workspace = await RelayCast.createWorkspace(`judge-simulation-${randomUUID().slice(0, 8)}`, { baseUrl: c.relayUrl, idempotencyKey: randomUUID() });
    const relay = new RelayCast({ apiKey: workspace.apiKey, baseUrl: c.relayUrl, retryPolicy: { maxRetries: 0 } });
    const garage = await relay.agents.register({ name: 'fictional-garage-advocate', type: 'agent' });
    const tea = await relay.agents.register({ name: 'fictional-tea-advocate', type: 'agent' });
    transport = { names: [garage.name, tea.name], clients: [relay.as(garage.token, { autoHeartbeatMs: false }), relay.as(tea.token, { autoHeartbeatMs: false })] };
    relayProof.status = 'ready-isolated-local-workspace';
  } catch { relayProof.status = 'not-used-unavailable'; }
  let final;
  for (let index = 0; index < 4; index++) {
    const from = index % 2, speaker = from === 0 ? 'Garage advocate' : 'Tea advocate';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${c.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: c.model, store: false, reasoning: { effort: c.reasoningEffort || 'low' }, max_output_tokens: index === 3 ? 600 : 250,
        instructions: `You are ONLY the ${speaker} in a clearly labeled fictional civic-coordination simulation. Two fictional businesses: Harbor Lane Garage and Saffron Kettle Tea. Act on their different needs and respond to the other advocate's latest actual message. This is not a real owner or real consent. No calls are placed. Do not approve anything. All pilot hours, delivery accommodations and trials are invented proposals, NOT official Winter Walk permit terms. Recorded street closure restrictions still apply; organizer/city access review remains unresolved. No price, wage, customer or market allocation. Write one short conversational turn, at most 40 words. ${index === 0 ? 'Open by protecting delivery access until6 and asking for a compromise.' : index === 1 ? 'Counter with an evening foot-traffic plan and a concrete access safeguard.' : index === 2 ? 'Respond with a specific compromise and remaining limit.' : 'Respond with a draft package of at most4 concise terms,1 tradeoff, and at least1 unresolved official access/approval question. Keep human approval pending.'} Output strict JSON.`,
        input: JSON.stringify({ source, fictionalOwnerBrief: brief, priorAdvocateMessages: messages.map(({ speaker, text }) => ({ speaker, text })) }),
        text: { format: { type: 'json_schema', name: 'judge_simulation_turn', strict: true, schema: index === 3 ? finalSchema : basic } },
      }),
    });
    if (!response.ok) throw new Error(`Model generation failed with HTTP ${response.status}; no fixture replaced.`);
    const data = await response.json();
    const raw = data.output?.flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('');
    if (!raw || data.status === 'incomplete') throw new Error('Incomplete model turn; no fixture replaced.');
    const parsed = JSON.parse(raw);
    assert.ok(typeof parsed.text === 'string' && parsed.text.trim());
    calls.push({ speaker, responseId: data.id, at: new Date().toISOString() });
    const message = { speaker, text: parsed.text.trim(), language: 'en', generatedBy: c.model, at: new Date().toISOString() };
    if (transport) {
      try {
        const to = 1 - from;
        const payload = JSON.stringify({ simulation: true, speaker, text: message.text });
        const sent = await transport.clients[from].dm(transport.names[to], payload, { idempotencyKey: randomUUID() });
        const history = await transport.clients[to].dms.messages(sent.conversationId, { limit: 20 });
        const received = history.find(x => x.id === sent.message.id && x.text === payload);
        if (!received) throw new Error('Recipient readback did not verify.');
        const delivery = (await transport.clients[to].deliveries({ limit: 20 })).find(x => x.messageId === received.id);
        if (!delivery) throw new Error('Durable delivery missing.');
        const ack = await transport.clients[to].ackDelivery(delivery.id);
        if (ack.status !== 'acked') throw new Error('Receipt not acknowledged.');
        message.receipt = { id: received.id, deliveryId: delivery.id, verified: true, acknowledged: true, transport: 'relaycast', at: new Date().toISOString() };
        relayProof.receipts.push(message.receipt); relayProof.used = true; relayProof.status = 'actual-isolated-relay';
      } catch { relayProof.status = relayProof.receipts.length ? 'partial-isolated-relay' : 'not-used-delivery-unverified'; transport = null; }
    }
    messages.push(message); if (index === 3) final = parsed;
  }
  const fixture = {
    simulation: true, generatedAt: new Date().toISOString(), source, messages, brief,
    notice: 'Prerecorded fictional simulation. Actual model generations and only marked verified Relay receipts are real. Outbound calls, business identities, owner actions and consent are simulated. No phone call was placed and no real visitor workspace was changed.',
    outbound: { mode: 'simulated', language: 'en', caller: 'CommonGround demo advocate', recipient: 'Fictional Harbor Lane Garage owner', actualCallsPlaced: 0 },
    proposal: { version: 1, title: 'Illustrative after-6 access and evening-footfall pilot', terms: final.terms, tradeoffs: final.tradeoffs, unresolved: [...final.unresolved, 'Every real owner must review and approve the current proposal version. No real approval has been collected.'], approval: 'simulated/pending', officialPermitTerms: false },
    steps: ['Cited public minutes identify a future closure.', 'A fictional relevance match triggers a simulated outbound call in the chosen language.', 'Four actual model turns explore the two fictional business needs.', 'Only verified isolated Relay deliveries are marked real.', 'The illustrative proposal remains pending human review; changing terms requires new review.'],
    proof: { provider: 'OpenAI Responses', model: c.model, openaiCalls: calls, relay: relayProof, elapsedMs: Date.now() - started, actualCallsPlaced: 0, realHumanApprovals: 0, visitorWorkspaceWrites: 0, usesPrivateOwnerData: false, playbackMakesNetworkCalls: false },
  };
  assert.equal(fixture.messages.length, 4); assert.equal(fixture.outbound.mode, 'simulated'); assert.equal(fixture.proposal.approval, 'simulated/pending');
  assert.ok(fixture.proposal.unresolved.length && fixture.proof.openaiCalls.length === 4);
  await mkdir(join(root, 'public'), { recursive: true });
  await writeFile(join(root, 'public', 'judge-simulation.json'), JSON.stringify(fixture, null, 2) + '\n');
  console.log(JSON.stringify({ generated: true, messages: messages.length, model: c.model, relayReceipts: relayProof.receipts.length, elapsedMs: fixture.proof.elapsedMs, actualCallsPlaced: 0 }));
}

if (process.argv.includes('--check')) {
  assert.equal(source.page, 3); assert.equal(source.item, 'C'); assert.equal(source.meetingDate, '2026-10-22');
  assert.ok(source.text.includes('December 4') && source.text.includes('December 30'));
  console.log('Simulation source and generation contract check passed. No API requests.');
} else await build();
