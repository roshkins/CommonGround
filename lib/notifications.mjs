import { createHash, randomUUID } from 'node:crypto';

export const POLL_MS = 15 * 60 * 1000;
const idFor = value => createHash('sha256').update(value).digest('hex');
const problem = (message, status = 400) => Object.assign(new Error(message), { status });
export function visitorKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw problem('A valid private visitor session is required.', 401);
  return value;
}
export function validateWatch(input = {}) {
  const needs = String(input.needs ?? '').trim();
  if (needs.length < 3 || needs.length > 1500) throw problem('Describe your needs in 3–1500 characters.');
  const streets = Array.isArray(input.streets) ? [...new Set(input.streets.map(s => String(s).trim()).filter(Boolean))] : [];
  if (streets.length > 8 || streets.some(s => s.length > 120)) throw problem('Use at most eight street or neighborhood names.');
  if (!['en', 'zh-Hant'].includes(input.language ?? 'en')) throw problem('Choose English or Traditional Chinese.');
  return { needs, streets, language: input.language ?? 'en', enabled: input.enabled !== false };
}
export function validateSubscription(input) {
  let url;
  try { url = new URL(input?.endpoint); } catch { throw problem('Invalid push subscription.'); }
  const h = url.hostname.toLowerCase();
  const allowed = h === 'fcm.googleapis.com' || h === 'web.push.apple.com' || h.endsWith('.push.apple.com') || h.endsWith('.push.services.mozilla.com') || h === 'updates.push.services.mozilla.com' || h.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || !allowed || url.username || url.password || url.hash || url.port || url.href.length > 4096) throw problem('Unsupported browser push endpoint.');
  const keys = input?.keys;
  if (!keys || !/^[A-Za-z0-9_-]{40,200}={0,2}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{16,100}={0,2}$/.test(keys.auth)) throw problem('Invalid push subscription keys.');
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
const tokens = value => String(value).toLowerCase().normalize('NFKC').match(/[a-z0-9]{3,}|[\p{Script=Han}]{2,}/gu) ?? [];
export function relevance(watch, chunk) {
  const hay = `${chunk.title} ${chunk.text} ${chunk.body ?? ''}`.toLowerCase();
  if (watch.streets.length && !watch.streets.some(s => hay.includes(s.toLowerCase()))) return null;
  const groups = [
    ['access', 'garage', 'delivery', 'vehicle', 'closure', 'street', '通行', '停車', '送貨', '封路'],
    ['noise', 'music', 'evening', 'night', '噪音', '音樂', '晚上'],
    ['foot', 'visitors', 'market', 'business', '人流', '街市', '商戶'],
    ['walking', 'accessibility', 'pedestrian', 'safe', '行人', '安全', '無障礙'],
  ];
  const query = watch.needs.toLowerCase();
  const expanded = new Set(tokens(query));
  for (const group of groups) if (group.some(t => query.includes(t))) group.forEach(t => expanded.add(t));
  const hits = [...expanded].filter(t => hay.includes(t));
  if (!hits.length) return null;
  return { score: Math.min(1, hits.length / 8), reason: watch.streets.length ? `Matches ${watch.streets.filter(s => hay.includes(s.toLowerCase())).join(', ')} and your saved needs.` : 'Matches topics in your saved needs. Review the source to check the actual impact.' };
}

export function createNotificationStore({ db, config = () => ({}), now = () => Date.now(), sendPush } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS agenda_watches(visitor_id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agenda_subscriptions(visitor_id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agenda_alerts(id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, item_id TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, UNIQUE(visitor_id,item_id,hash));
    CREATE INDEX IF NOT EXISTS agenda_alerts_visitor ON agenda_alerts(visitor_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS agenda_outbox(id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, last_error TEXT);
    CREATE TABLE IF NOT EXISTS agenda_call_preferences(visitor_id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agenda_call_intents(id TEXT PRIMARY KEY,visitor_id TEXT NOT NULL,alert_id TEXT NOT NULL,token TEXT NOT NULL UNIQUE,body TEXT NOT NULL,status TEXT NOT NULL,call_sid TEXT,created_at TEXT NOT NULL,last_error TEXT,UNIQUE(visitor_id,alert_id));`);
  const iso = () => new Date(now()).toISOString();
  const parse = row => row ? JSON.parse(row.body) : null;
  const getWatch = visitor => parse(db.prepare('SELECT body FROM agenda_watches WHERE visitor_id=?').get(visitorKey(visitor)));
  const listAlerts = visitor => db.prepare('SELECT * FROM agenda_alerts WHERE visitor_id=? ORDER BY created_at DESC LIMIT 100').all(visitorKey(visitor)).map(row => ({ ...JSON.parse(row.body), id: row.id, createdAt: row.created_at, read: Boolean(row.read_at) }));
  async function deliver(subscription, payload) {
    if (sendPush) return sendPush(subscription, payload);
    const c = config();
    if (!c.vapidPublicKey || !c.vapidPrivateKey || !c.vapidSubject) throw problem('Browser push is not configured on the server.', 503);
    const { default: webpush } = await import('web-push');
    return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, timeout: 10000, vapidDetails: { subject: c.vapidSubject, publicKey: c.vapidPublicKey, privateKey: c.vapidPrivateKey } });
  }
  function enqueue(visitor, id, payload) {
    db.prepare('INSERT OR IGNORE INTO agenda_outbox(id,visitor_id,body) VALUES(?,?,?)').run(id, visitor, JSON.stringify(payload));
  }
  const service = {
    getAlert(visitor, id) { const row = db.prepare('SELECT * FROM agenda_alerts WHERE visitor_id=? AND id=?').get(visitorKey(visitor), String(id)); return row ? { ...JSON.parse(row.body), id: row.id, createdAt: row.created_at, read: Boolean(row.read_at) } : null; },
    getCallPreference(visitor) { return parse(db.prepare('SELECT body FROM agenda_call_preferences WHERE visitor_id=?').get(visitorKey(visitor))); },
    saveCallPreference(visitor, preference) {
      visitorKey(visitor);
      const next = { ...preference, updatedAt: iso() };
      db.prepare('INSERT INTO agenda_call_preferences VALUES(?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(visitor, JSON.stringify(next), iso());
      if (!next.enabled) db.prepare("UPDATE agenda_call_intents SET status='cancelled' WHERE visitor_id=? AND status='pending'").run(visitor);
      return next;
    },
    getCallIntent(token) {
      const row = db.prepare('SELECT * FROM agenda_call_intents WHERE token=?').get(String(token));
      return row ? { ...JSON.parse(row.body), id: row.id, visitorId: row.visitor_id, token: row.token, status: row.status, callSid: row.call_sid } : null;
    },
    cancelPendingCall(token) { db.prepare("UPDATE agenda_call_intents SET status='cancelled' WHERE token=? AND status='pending'").run(String(token)); },
    callTestState(visitor) {
      const rows = db.prepare("SELECT status,body,created_at FROM agenda_call_intents WHERE visitor_id=? AND json_extract(body,'$.test')=1 ORDER BY created_at DESC").all(visitorKey(visitor));
      const recent = rows.filter(r => Date.parse(r.created_at) > now() - 3600000 && r.status !== 'cancelled');
      const blocked = rows.some(r => !['completed','busy','failed','no-answer','canceled','cancelled'].includes(r.status));
      return { maxTestsPerHour: 3, testsLastHour: recent.length, lastTestStatus: rows[0]?.status || null, testRetryBlocked: blocked || recent.length >= 3 };
    },
    queueCallTest(visitor, source) {
      visitorKey(visitor); const pref = service.getCallPreference(visitor);
      if (!pref?.enabled) throw problem('Enable your own verified agenda-call preference first.', 403);
      const testState = service.callTestState(visitor);
      if (testState.testRetryBlocked) throw problem(testState.testsLastHour >= 3 ? 'The three-test hourly limit has been used.' : 'Wait for the previous test to finish; unknown outcomes cannot be blindly retried.', testState.testsLastHour >= 3 ? 429 : 409);
      if (db.prepare("SELECT id FROM agenda_call_intents WHERE visitor_id=? AND status IN ('pending','dispatching','queued','initiated','ringing','in-progress','answered','unknown') LIMIT 1").get(visitor)) throw problem('An agenda call is still active or uncertain.', 409);
      const previous = db.prepare("SELECT body FROM agenda_call_intents WHERE visitor_id=? AND json_extract(body,'$.test')=1 AND created_at>? ORDER BY created_at DESC LIMIT 1").get(visitor, new Date(now() - 3600000).toISOString());
      if (previous && JSON.parse(previous.body).phoneNumber !== pref.phoneNumber) throw problem('Test retries must use the same saved recipient.', 403);
      if (!source?.url || new URL(source.url).hostname !== 'www.sfmta.com' || !source.text) throw problem('A verified existing public source is required.', 503);
      const id = `test-${randomUUID()}`, token = randomUUID();
      const alert = { ...source, text: String(source.text).slice(0, 700), source: 'SFMTA', test: true, baseline: false, reason: 'Explicitly requested TEST using an existing document; this is not a new publication.' };
      db.prepare('INSERT INTO agenda_alerts VALUES(?,?,?,?,?,?,NULL)').run(id, visitor, id, id, JSON.stringify(alert), iso());
      db.prepare("INSERT INTO agenda_call_intents VALUES(?,?,?,?,?,'pending',NULL,?,NULL)").run(id, visitor, id, token, JSON.stringify({ phoneNumber: pref.phoneNumber, language: pref.language, participant: pref.participant || 'tea', alertId: id, test: true }), iso());
      return service.getCallIntent(token);
    },
    updateCallIntent(token, callSid, status) {
      const intent = service.getCallIntent(token);
      if (!intent || !/^CA[a-f0-9]{32}$/i.test(callSid) || (intent.callSid && intent.callSid !== callSid)) throw problem('Unknown outbound call.', 403);
      if (['completed','busy','failed','no-answer','canceled'].includes(intent.status)) return intent;
      const allowed = ['queued','initiated','ringing','in-progress','answered','completed','busy','failed','no-answer','canceled'];
      if (!allowed.includes(status)) throw problem('Invalid outbound status.');
      db.prepare('UPDATE agenda_call_intents SET call_sid=?,status=? WHERE token=?').run(callSid, status, token);
      return service.getCallIntent(token);
    },
    async flushAgendaCalls(createCall, { visitorId } = {}) {
      let dispatched = 0, unknown = 0;
      const rows = visitorId ? db.prepare("SELECT * FROM agenda_call_intents WHERE status='pending' AND visitor_id=? ORDER BY created_at LIMIT 5").all(visitorKey(visitorId)) : db.prepare("SELECT * FROM agenda_call_intents WHERE status='pending' ORDER BY created_at LIMIT 5").all();
      for (const row of rows) {
        const pref = service.getCallPreference(row.visitor_id), intent = service.getCallIntent(row.token), watch = getWatch(row.visitor_id);
        if (!pref?.enabled || (!intent.test && !watch?.enabled) || pref.phoneNumber !== intent.phoneNumber || pref.updatedAt > row.created_at || !Number.isFinite(Date.parse(pref.verifiedAt)) || now() - Date.parse(pref.verifiedAt) > 7 * 86400000) { db.prepare("UPDATE agenda_call_intents SET status='cancelled' WHERE id=? AND status='pending'").run(row.id); continue; }
        if (db.prepare("SELECT COUNT(*) AS n FROM agenda_call_intents WHERE status IN ('dispatching','queued','initiated','ringing','in-progress','answered','unknown')").get().n >= 3) break;
        // Persist the one allowed attempt before touching Twilio. A process crash
        // or ambiguous HTTP failure MUST NOT cause a blind redial.
        if (!db.prepare("UPDATE agenda_call_intents SET status='dispatching' WHERE id=? AND status='pending'").run(row.id).changes) continue;
        try {
          const result = await createCall(intent);
          service.updateCallIntent(row.token, result.sid, 'queued'); dispatched++;
        } catch { db.prepare("UPDATE agenda_call_intents SET status='unknown',last_error='Dispatch outcome unknown; automatic redial disabled' WHERE id=? AND call_sid IS NULL").run(row.id); unknown++; }
      }
      return { dispatched, unknown };
    },
    getWatch,
    saveWatch(visitor, input) {
      visitorKey(visitor); const watch = { ...validateWatch(input), updatedAt: iso() };
      db.prepare('INSERT INTO agenda_watches VALUES(?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(visitor, JSON.stringify(watch), iso());
      if(!watch.enabled)db.prepare("UPDATE agenda_outbox SET status='cancelled' WHERE visitor_id=? AND status='pending'").run(visitor);
      return watch;
    },
    alerts: listAlerts,
    markRead(visitor, id) {
      return db.prepare('UPDATE agenda_alerts SET read_at=? WHERE id=? AND visitor_id=?').run(iso(), String(id), visitorKey(visitor)).changes === 1;
    },
    subscribe(visitor, input) {
      visitorKey(visitor); const sub = validateSubscription(input);
      db.prepare('INSERT INTO agenda_subscriptions VALUES(?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(visitor, JSON.stringify(sub), iso());
      return { subscribed: true };
    },
    unsubscribe(visitor) {
      visitorKey(visitor);
      db.prepare('DELETE FROM agenda_subscriptions WHERE visitor_id=?').run(visitor);
      db.prepare("UPDATE agenda_outbox SET status='cancelled' WHERE visitor_id=? AND status='pending'").run(visitor);
      return { subscribed: false };
    },
    async sendTest(visitor) {
      visitorKey(visitor);
      if (!db.prepare('SELECT visitor_id FROM agenda_subscriptions WHERE visitor_id=?').get(visitor)) throw problem('Enable browser notifications first.', 409);
      const id = `test-${randomUUID()}`;
      enqueue(visitor, id, { title: 'CommonGround test notification', body: 'This is a test. Agenda alerts will appear here when a relevant new item is published.', url: '/?view=agendas', tag: id, test: true });
      const result = await service.flushNotifications();
      const row = db.prepare('SELECT status FROM agenda_outbox WHERE id=?').get(id);
      return { test: true, delivered: row.status === 'sent', status: row.status, ...result };
    },
    ingest(chunks, { baseline = false } = {}) {
      let added = 0;
      for (const record of db.prepare('SELECT visitor_id,body FROM agenda_watches').all()) {
        const watch = JSON.parse(record.body); if (!watch.enabled) continue;
        for (const chunk of chunks) {
          if (new Date(chunk.meetingDate).getTime() < now()) continue;
          const match = relevance(watch, chunk); if (!match) continue;
          const hash = chunk.contentHash || idFor(chunk.text);
          const id = idFor(`${record.visitor_id}:${chunk.id}:${hash}`);
          const payload = { title: chunk.title, text: chunk.text.slice(0,700), meetingDate: chunk.meetingDate, url: chunk.url, page: chunk.page, item: chunk.item, body: chunk.body, reason: match.reason, source: 'SFMTA', baseline, test: false };
          const change = db.prepare('INSERT OR IGNORE INTO agenda_alerts VALUES(?,?,?,?,?,?,NULL)').run(id, record.visitor_id, chunk.id, hash, JSON.stringify(payload), iso());
          if (!change.changes) continue;
          added++;
          const callPref = service.getCallPreference(record.visitor_id);
          if (!baseline && callPref?.enabled && Date.parse(callPref.updatedAt) <= now() && !db.prepare("SELECT id FROM agenda_call_intents WHERE visitor_id=? AND created_at>? AND status!='cancelled' AND COALESCE(json_extract(body,'$.test'),0)=0 LIMIT 1").get(record.visitor_id, new Date(now() - 86400000).toISOString())) {
            const token = randomUUID(), callId = idFor(`agenda-call:${id}`);
            db.prepare("INSERT OR IGNORE INTO agenda_call_intents VALUES(?,?,?,?,?,'pending',NULL,?,NULL)").run(callId, record.visitor_id, id, token, JSON.stringify({ phoneNumber: callPref.phoneNumber, language: callPref.language, participant: callPref.participant || 'tea', alertId: id }), iso());
          }
          // Initial sync populates the inbox but never pretends old documents just arrived.
          if (!baseline && db.prepare('SELECT visitor_id FROM agenda_subscriptions WHERE visitor_id=?').get(record.visitor_id)) enqueue(record.visitor_id, id, { title: 'CommonGround agenda match', body: `${chunk.title}. ${match.reason}`, url: `/?view=agendas&alert=${id}`, tag: id });
        }
      }
      return added;
    },
    async flushNotifications() {
      let sent = 0; let failed = 0;
      const rows = db.prepare("SELECT * FROM agenda_outbox WHERE status='pending' AND next_at<=? AND lease_until<=? ORDER BY rowid LIMIT 20").all(now(), now());
      for (const row of rows) {
        const lease = now() + 30000;
        const claim = db.prepare("UPDATE agenda_outbox SET lease_until=? WHERE id=? AND status='pending' AND lease_until<=?").run(lease, row.id, now());
        if (!claim.changes) continue;
        const subscription = parse(db.prepare('SELECT body FROM agenda_subscriptions WHERE visitor_id=?').get(row.visitor_id));
        if (!subscription) { db.prepare("UPDATE agenda_outbox SET status='cancelled',lease_until=0 WHERE id=?").run(row.id); continue; }
        try {
          await deliver(subscription, JSON.parse(row.body));
          db.prepare("UPDATE agenda_outbox SET status='sent',lease_until=0,last_error=NULL WHERE id=?").run(row.id); sent++;
        } catch (error) {
          failed++;
          if ([404,410].includes(error.statusCode)) {
            db.prepare('DELETE FROM agenda_subscriptions WHERE visitor_id=?').run(row.visitor_id);
            db.prepare("UPDATE agenda_outbox SET status='expired',lease_until=0,last_error='Subscription expired' WHERE id=?").run(row.id);
          } else {
            const attempts = row.attempts + 1;
            db.prepare('UPDATE agenda_outbox SET status=?,attempts=?,next_at=?,lease_until=0,last_error=? WHERE id=?').run(attempts >= 5 ? 'failed' : 'pending', attempts, now() + Math.min(POLL_MS * 2 ** attempts, 86400000), 'Push delivery failed; will retry within the configured limit.', row.id);
          }
        }
      }
      return { sent, failed };
    },
  };
  return service;
}
