import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readConfig } from './lib/config.mjs';
import { createStore } from './lib/store.mjs';
import { createServices } from './lib/services.mjs';
import { createPlatform } from './lib/platform.mjs';
import { createActivityTrace } from './lib/activity.mjs';
import { PEOPLE, addEvent, addProposal, assertCivic, currentProposal, fail, language, person, proposalStale, publishView, recordDecision, shareBrief, text } from './lib/domain.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ASSETS = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/features.js': ['features.js', 'text/javascript'], '/sw.js': ['sw.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/service-flow.html': ['service-flow.html', 'text/html'], '/service-flow.js': ['service-flow.js', 'text/javascript'], '/service-flow.css': ['service-flow.css', 'text/css'], '/judge.html': ['judge.html', 'text/html'], '/judge.js': ['judge.js', 'text/javascript'], '/judge.css': ['judge.css', 'text/css'], '/judge-simulation.json': ['judge-simulation.json', 'application/json'], '/demo-final.mp4': ['demo-final.mp4', 'video/mp4'], '/demo-final.vtt': ['demo-final.vtt', 'text/vtt'] };

ASSETS['/demo-outreach-en.mp3'] = ['demo-outreach-en.mp3', 'audio/mpeg'];
ASSETS['/'] = ['judge.html', 'text/html'];
ASSETS['/workspace.html'] = ['index.html', 'text/html'];
ASSETS['/outbound-proof.json'] = ['outbound-proof.json', 'application/json'];

export function createApp({ dbPath = join(ROOT, 'data', 'common-ground.sqlite'), config = () => readConfig(ROOT), services: suppliedServices } = {}) {
  const activity = createActivityTrace();
  const store = createStore(dbPath);
  const streams = new Set();
  let negotiating = false;
  const progress = event => { for (const res of streams) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  const services = suppliedServices || createServices({ root: ROOT, config, progress, activity });
  const view = (room, selected) => ({ ...publishView(room, selected), services: services.status() });
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  async function body(req, limit = 15000) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > limit) fail(413, 'The request is too large.'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  const platform = config().workspaceStorage ? createPlatform({ root: ROOT, config, services, json, body, activity }) : null;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
    try {
      const host = req.headers.host || '';
      const publicOrigin = config().publicOrigin;
      const origin = publicOrigin || `http://${host}`;
      const localHost = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
      if (!localHost && (!platform || !publicOrigin || host !== new URL(publicOrigin).host)) fail(403, 'This hostname is not configured for the demo.');
      const url = new URL(req.url, origin);
      if (req.headers.origin && req.headers.origin !== origin) fail(403, 'Cross-origin requests are not allowed.');
      if (req.headers['sec-fetch-site'] === 'cross-site' && url.pathname.startsWith('/api/')) fail(403, 'Cross-site requests are not allowed.');
      if (platform && await platform.handle(req, res, url)) return;
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(': connected\n\n'); streams.add(res);
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000); heartbeat.unref();
        req.on('close', () => { clearInterval(heartbeat); streams.delete(res); }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        return json(res, 200, view(store.read(), url.searchParams.get('participant') || 'tea'));
      }
      if (req.method === 'GET' && url.pathname === '/api/export') {
        const room = store.read(); const publicState = publishView(room, 'tea');
        const artifact = { label: 'FICTIONAL DEMO — NOT REAL OWNER CONSENT — NOT SUBMITTED', exportedAt: new Date().toISOString(), proposal: publicState.proposal, approvals: publicState.approvals, unresolvedApproval: !publicState.allApproved, proposalStale: publicState.proposalStale, authorizedBriefs: publicState.participants.map(p => ({ business: p.name, brief: p.shared })), evidence: publicState.evidence };
        res.setHeader('Content-Disposition', 'attachment; filename="common-ground-demo-proposal.json"'); return json(res, 200, artifact);
      }
      if (req.method === 'POST' && url.pathname === '/api/transcribe') {
        language(url.searchParams.get('language') || 'en');
        const result = await services.transcribe(await body(req, 10 * 1024 * 1024), req.headers['content-type'] || '', url.searchParams.get('language') || 'en');
        return json(res, 200, result);
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Use application/json.');
        let input;
        try { input = JSON.parse((await body(req)).toString('utf8')); } catch (error) { if (error.status) throw error; fail(400, 'Invalid JSON.'); }
        if (!input || typeof input !== 'object') fail(400, 'Invalid request.');
        const room = store.read(); const expected = room.revision;
        if (input.revision !== expected) fail(409, 'The workspace changed. Refresh before saving.');
        const selected = input.participant || 'tea'; person(selected);
        if (negotiating) fail(409, 'A negotiation is running. Wait for it to finish before editing the workspace.');
        if (url.pathname === '/api/understand') {
          const concern = text(input.text); const lang = language(input.language); assertCivic(concern);
          if (!['live', 'rehearsal'].includes(input.mode)) fail(400, 'Choose live AI or rehearsal.');
          const understanding = await services.understand(concern, person(selected), lang, input.mode);
          room.participants[selected].language = lang;
          room.participants[selected].draft = { id: randomUUID(), original: concern, understanding, mode: input.mode, at: new Date().toISOString() };
          addEvent(room, 'understood', { participant: selected, mode: input.mode });
        } else if (url.pathname === '/api/share') {
          // Screen the exact edited brief, rather than trusting the earlier private draft.
          const draft = room.participants[selected].draft;
          if (input.consent !== true || draft?.id !== input.draftId) fail(400, 'Review the current draft and authorize the exact brief first.');
          const exactBrief = text(input.brief, 3000); assertCivic(exactBrief);
          if (draft.mode === 'live') await services.screenBrief(exactBrief);
          shareBrief(room, { ...input, participant: selected });
        } else if (url.pathname === '/api/negotiate') {
          if (!['live', 'rehearsal'].includes(input.mode) || !['relaycast', 'rehearsal'].includes(input.transport)) fail(400, 'Choose a supported AI mode and transport.');
          if (PEOPLE.some(p => !room.participants[p.id].shared)) fail(409, 'Review and authorize all three owner briefs first.');
          negotiating = true;
          try {
            const result = await services.negotiate(room, input.mode, input.transport);
            room.exchanges.push(...result.exchange);
            const proposal = addProposal(room, result.content, input.mode, input.transport);
            proposal.critiqueIssues = result.critiqueIssues ?? [];
          } finally { negotiating = false; progress({ stage: 'idle' }); }
        } else if (url.pathname === '/api/decision') {
          if (typeof input.note === 'string' && input.note.trim()) {
            const note = text(input.note, 2000); assertCivic(note);
            if (currentProposal(room)?.mode === 'live') await services.screenBrief(note);
          }
          recordDecision(room, { ...input, participant: selected });
        } else if (url.pathname === '/api/revise') {
          const previous = currentProposal(room);
          if (!previous || previous.version !== input.version || proposalStale(room)) fail(409, 'Review the current proposal and negotiate any changed briefs before revising.');
          const revision = text(input.note, 2000); assertCivic(revision);
          if (previous.mode === 'live') {
            await services.screenBrief(revision);
            const revised = await services.reviseProposal(room, revision);
            const proposal = addProposal(room, revised.proposal, previous.mode, previous.transport);
            proposal.critiqueIssues = revised.issues;
            proposal.ownerRevision = { participant: selected, original: revision };
          } else {
            const content = structuredClone(previous.content);
            content.en.terms.push(`Owner revision (original language): ${revision}`);
            content['zh-Hant'].terms.push(`店主修訂（原文）：${revision}`);
            content.en.unresolved.push('This manual addition has not been translated. Generate a live bilingual option before approving.');
            content['zh-Hant'].unresolved.push('此手動新增內容尚未翻譯。請產生即時雙語方案後再批准。');
            const proposal = addProposal(room, content, previous.mode, previous.transport);
            proposal.translationPending = true;
          }
        } else if (url.pathname === '/api/restart') {
          return json(res, 200, view(store.restart(), selected));
        } else fail(404, 'Unknown endpoint.');
        store.save(room, expected);
        progress({ stage: 'saved', revision: room.revision });
        return json(res, 200, view(room, selected));
      }
      if (req.method === 'GET' && ASSETS[url.pathname]) {
        const [file, mime] = ASSETS[url.pathname];
        const data = readFileSync(join(ROOT, 'public', file));
        const media = /^(video|audio)\//.test(mime);
        const headers = { 'Content-Type': media ? mime : `${mime}; charset=utf-8`, 'Cache-Control': 'no-cache', 'Content-Length': data.length };
        if (media) {
          headers['Accept-Ranges'] = 'bytes';
          if (req.headers.range) {
            const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            let start = range?.[1] ? Number(range[1]) : 0;
            let end = range?.[2] ? Number(range[2]) : data.length - 1;
            if (range && !range[1] && range[2]) { start = Math.max(0, data.length - Number(range[2])); end = data.length - 1; }
            if (!range || (!range[1] && !range[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= data.length || end < start) {
              res.writeHead(416, { 'Content-Range': `bytes */${data.length}`, 'Content-Length': 0 }); return res.end();
            }
            end = Math.min(end, data.length - 1);
            res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
            return res.end(data.subarray(start, end + 1));
          }
        }
        res.writeHead(200, headers);
        return res.end(data);
      }
      fail(404, 'Not found.');
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'An unexpected error occurred. No approval was recorded. Please try again.' });
      else res.end();
    }
  });
  server.on('close', () => { for (const stream of streams) stream.end(); store.close(); platform?.close().catch(() => {}); });
  return { server, store, platform };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig(ROOT);
  const { server } = createApp();
  server.listen(config.port, config.host, () => console.log(`Common Ground: ${config.publicOrigin || `http://${config.host}:${server.address().port}`}\nFictional demo. Secrets remain on the server.`));
  server.on('error', error => { console.error(`Could not start Common Ground (${error.code}).`); process.exitCode = 1; });
}
