import { randomUUID, timingSafeEqual, createHmac } from 'node:crypto';
import { createWorkspaceManager } from './workspaces.mjs';
import { createAgendaService } from './agendas.mjs';
import { fail, language, person } from './domain.mjs';
import { createActivityTrace } from './activity.mjs';

export function createPlatform({ root, config, services, json, body, activity = createActivityTrace() }) {
  const streams = new Map();
  const progress = event => {
    for (const entry of streams.values()) if (entry.workspaceId === event.workspaceId && (!event.visitorId || entry.visitorId === event.visitorId)) entry.res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const workspaces = createWorkspaceManager({ root, config, services, progress });
  const agendas = createAgendaService({ root, config, fetchImpl: (target, options) => {
    const url = new URL(target);
    const service = url.hostname === 'api.openai.com' ? 'openai' : url.hostname === 'www.sfmta.com' || url.hostname === 'sfmta.com' ? 'sfmta' : 'supabase';
    const operation = service === 'openai' ? 'Agenda query embedding' : service === 'sfmta' ? 'Official agenda source request' : 'Agenda vector collection request';
    return activity.track(service, operation, () => fetch(target, options));
  } });
  let phonePromise;
  const phone = () => phonePromise ??= import('./phone.mjs').then(({ createPhoneService }) => createPhoneService({ root, config, workspaces, agendas, services, activity }));
  const counts = new Map();
  function limit(key, maximum, windowMs = 3600000) {
    const at = Date.now(); let entry = counts.get(key);
    if (!entry || entry.until < at) { entry = { until: at + windowMs, count: 0 }; counts.set(key, entry); }
    if (++entry.count > maximum) fail(429, 'This demo has reached its live-request limit. Try again later; no simulated response was substituted.');
    if (counts.size > 10000) for (const [k, v] of counts) if (v.until < at) counts.delete(k);
  }
  function visitor(req, res) {
    const secret = config().internalToken;
    if (!secret) fail(503, 'Private session signing is not configured. Run the local-secret setup before starting the app.');
    const sign = id => createHmac('sha256', secret).update(`visitor:${id}`).digest('base64url');
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('cg_visitor='))?.slice(11);
    const [claimed, signature] = (cookie || '').split('.');
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(claimed || '') && /^[A-Za-z0-9_-]{43}$/.test(signature || '') && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(claimed)))) return claimed;
    const id = randomUUID();
    res.setHeader('Set-Cookie', `cg_visitor=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${config().publicOrigin?.startsWith('https:') ? '; Secure' : ''}`);
    return id;
  }
  const input = async req => {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Use application/json.');
    let value; try { value = JSON.parse((await body(req, 20000)).toString('utf8')); } catch (e) { if (e.status) throw e; fail(400, 'Invalid JSON.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid input.');
    return value;
  };
  function internal(req) {
    const expected = config().internalToken;
    const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) fail(403, 'Invalid internal authorization.');
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403, 'Private server-to-server route.');
  }
  async function view(id, perspective) {
    const state = await workspaces.getView(id, perspective);
    const c = config();
    state.services = { ...state.services, phoneNumber: c.phoneNumber || '', phone: { configured: Boolean(c.phoneNumber && c.twilioSid && c.twilioToken && c.openaiKey), phoneNumber: c.phoneNumber || '' }, agendas: agendas.getStatus(), supabase: agendas.getStatus().vectorReady ? 'verified' : c.supabaseKey && c.supabaseUrl ? 'configured-not-connected' : 'not-connected' };
    return state;
  }
  async function handle(req, res, url) {
    if (url.pathname.startsWith('/phone/')) { return (await phone()).handle(req, res, url); }
    if (url.pathname.startsWith('/internal/phone/')) {
      internal(req); if (req.method !== 'POST') fail(405, 'Use POST.');
      const data = await input(req); const p = await phone();
      if (url.pathname === '/internal/phone/context') json(res, 200, await p.context(data.callSid));
      else if (url.pathname === '/internal/phone/tool') json(res, 200, await p.tool(data.callToken, data.action, data.args || {}));
      else if (url.pathname === '/internal/phone/transcript') json(res, 200, await p.recordTranscript(data.callSid, data.transcript));
      else if (url.pathname === '/internal/phone/event') {
        const operations = { 'live-session-started': ['openai', 'GPT-Live session started'], 'live-first-audio': ['openai', 'First live audio received by bridge'], 'live-session-ended': ['twilio', 'Live audio segment ended'] };
        const operation = operations[data.event]; if (!operation) fail(400, 'Unknown service event.');
        const context = await p.context(data.callSid);
        activity.run({ visitorId: context.visitorId }, () => activity.record(...operation, 'succeeded'));
        json(res, 200, { ok: true });
      }
      else fail(404, 'Not found.');
      return true;
    }
    if (url.pathname === '/healthz') {
      await workspaces.getView('healthcheck-00000001');
      json(res, 200, { status: 'ready', app: 'CommonGround', storage: workspaces.status().storage, storageVerified: true, fictionalDemo: true }); return true;
    }
    if (!url.pathname.startsWith('/api/')) return false;
    const id = visitor(req, res);
    const perspective = url.searchParams.get('participant') || 'tea'; person(perspective);
    limit(`${id}:requests`, 600, 60000);
    if (req.method === 'GET') {
      if (url.pathname === '/api/state') json(res, 200, await activity.run({ visitorId: id }, () => config().workspaceStorage === 'terse' ? activity.track('terse', 'Read private and negotiation actors', () => view(id, perspective)) : view(id, perspective)));
      else if (url.pathname === '/api/activity') { const state = await view(id, perspective); json(res, 200, { events: activity.read(id), services: state.services, workspace: state.workspace, retention: 'Current server process; operational metadata only' }); }
      else if (url.pathname === '/api/events') {
        const state = await workspaces.getView(id, perspective); const streamId = randomUUID();
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write(': connected\n\n');
        streams.set(streamId, { res, workspaceId: state.id, visitorId: id });
        let revision = state.revision, participantRevision = state.participantRevision, running = false;
        const heartbeat = setInterval(async () => {
          if (running) return; running = true;
          try { const next = await workspaces.getView(id, perspective); if (!streams.has(streamId)) return; if (next.revision !== revision || next.participantRevision !== participantRevision || next.id !== streams.get(streamId).workspaceId) { revision = next.revision; participantRevision = next.participantRevision; streams.get(streamId).workspaceId = next.id; res.write(`data: ${JSON.stringify({ stage: 'saved', revision, participantRevision, visitorId: id, workspaceId: next.id })}\n\n`); } else res.write(': heartbeat\n\n'); } catch { res.write('data: {"stage":"reconnecting"}\n\n'); } finally { running = false; }
        }, 5000); heartbeat.unref();
        req.on('close', () => { clearInterval(heartbeat); streams.delete(streamId); });
      }
      else if (url.pathname === '/api/export') {
        const state = await workspaces.getView(id, perspective);
        res.setHeader('Content-Disposition', 'attachment; filename="common-ground-demo-proposal.json"');
        json(res, 200, { label: 'FICTIONAL DEMO — NOT REAL OWNER CONSENT — NOT SUBMITTED', exportedAt: new Date().toISOString(), proposal: state.proposal, approvals: state.approvals, authorizedBriefs: state.contributors, unresolvedApproval: !state.allApproved });
      }
      else if (url.pathname === '/api/agendas') { limit(`${id}:search`, 60); json(res, 200, await activity.run({ visitorId: id }, () => agendas.search({ query: (url.searchParams.get('q') || '').slice(0, 1000), period: url.searchParams.get('period') || 'all', visitorId: id }))); }
      else if (url.pathname === '/api/agenda-watch') json(res, 200, { watch: await agendas.getWatch(id) });
      else if (url.pathname === '/api/outbound-preferences') json(res, 200, await (await phone()).outboundPreferences(id));
      else if (url.pathname === '/api/agenda-alerts') json(res, 200, { alerts: await agendas.alerts(id), status: agendas.getStatus() });
      else if (url.pathname === '/api/push/key') json(res, 200, { publicKey: config().vapidPublicKey || null });
      else fail(404, 'Unknown endpoint.');
      return true;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/push/subscription') { await agendas.unsubscribe(id); json(res, 200, { ok: true }); return true; }
    if (req.method !== 'POST') fail(405, 'Unsupported method.');
    if (url.pathname === '/api/transcribe') {
      limit(`${id}:audio`, 20); const lang = language(url.searchParams.get('language') || 'en');
      json(res, 200, await services.transcribe(await body(req, 10 * 1024 * 1024), req.headers['content-type'] || '', lang)); return true;
    }
    const data = await input(req);
    if (url.pathname === '/api/phone/pair') { limit(`${id}:phone-pair`, 5); json(res, 200, await activity.run({ visitorId: id }, () => (phone()).then(p => p.pair(id, data)))); }
    else if (url.pathname === '/api/outbound-preferences') { limit(`${id}:outbound-preferences`, 10); json(res, 200, await (await phone()).saveOutboundPreferences(id, data)); }
    else if (url.pathname === '/api/outbound-test') { limit(`${id}:outbound-test`, 10); json(res, 200, await (await phone()).testAgendaCall(id, data)); }
    else if (url.pathname === '/api/agenda-watch') {
      const topics = data.needs ?? (Array.isArray(data.topics) ? data.topics.join(', ') : data.topics) ?? '';
      const streets = data.streets ?? data.areas ?? [];
      const watch = await agendas.saveWatch(id, { needs: String(topics), streets: Array.isArray(streets) ? streets : String(streets).split(',').map(s => s.trim()).filter(Boolean), language: data.language || 'en', enabled: data.enabled === true });
      json(res, 200, { watch });
    }
    else if (/^\/api\/agenda-alerts\/[^/]+\/read$/.test(url.pathname)) json(res, 200, { ok: await agendas.markRead(id, decodeURIComponent(url.pathname.split('/')[3])) });
    else if (url.pathname === '/api/push/subscription') { await agendas.subscribe(id, data.subscription || data); json(res, 200, { ok: true }); }
    else if (url.pathname === '/api/push/test') { limit(`${id}:test-push`, 5); json(res, 200, await agendas.sendTest(id)); }
    else {
      const action = url.pathname.slice(5);
      if (!['understand', 'share', 'negotiate', 'decision', 'revise', 'restart', 'join', 'private'].includes(action)) fail(404, 'Unknown endpoint.');
      if (action === 'understand') limit(`${id}:understand`, 30);
      if (['negotiate', 'revise'].includes(action)) { limit(`${id}:negotiate`, 5); limit('global:negotiate', 30); }
      if (action === 'share') limit(`${id}:share`, 30);
      const state = await activity.run({ visitorId: id }, () => config().workspaceStorage === 'terse' ? activity.track('terse', 'Durable workspace operation', () => workspaces.execute(id, action, data)) : workspaces.execute(id, action, data));
      progress({ stage: 'saved', revision: state.revision, workspaceId: state.id });
      json(res, 200, { ...state, services: (await view(id, data.participant || data.perspective || 'tea')).services });
    }
    return true;
  }
  return { handle, workspaces, agendas, phone, async close() { for (const { res } of streams.values()) res.end(); streams.clear(); await workspaces.close(); agendas.close(); if (phonePromise) (await phonePromise).close(); } };
}
