const names = { openai: 'OpenAI', relaycast: 'Agent Relay', terse: 'Terse', supabase: 'Supabase', twilio: 'Twilio', freestyle: 'Freestyle', sfmta: 'SFMTA', push: 'Inbox & push' };
const nodes = new Map([...document.querySelectorAll('[data-service]')].map(node => [node.dataset.service, node]));
const seen = new Map();
let events = [], selected = null, firstPoll = true, inFlight = false, lastWorkspaceId = null;
const text = (id, value) => { document.getElementById(id).textContent = value; };
const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Time unavailable' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles' }); };
function staticStatus(service, s) {
  if (service === 'freestyle') return location.hostname.endsWith('.style.dev') ? 'Hosted deployment · not per-request API' : 'Deployment host · local preview';
  if (service === 'openai') return s.openaiVerified ? 'Live response verified' : s.openai === 'configured' ? 'Configured · awaiting recorded request' : 'Not configured';
  if (service === 'terse') return s.persistence === 'terse-runtime' ? (s.terse === 'verified' ? 'Actor runtime verified' : 'Terse runtime selected') : s.persistence === 'explicit-local-sqlite' ? 'Explicit local SQLite mode' : 'Awaiting runtime status';
  if (service === 'supabase') return s.supabase === 'verified' || s.agendas?.vectorReady ? 'Vector retrieval verified' : s.supabase === 'not-connected' ? 'Not connected' : 'Awaiting retrieval verification';
  if (service === 'relaycast') return s.relay === 'verified' ? 'Actual message receipts verified' : 'Awaiting recorded exchange';
  if (service === 'twilio') return s.phone?.configured ? 'Phone configured · agenda calls require opt-in' : 'Phone awaiting configuration';
  if (service === 'sfmta') return s.agendas?.lastSuccessfulAt ? 'Official source fetch verified' : 'Awaiting source check';
  return 'Optional notifications · delivery separate';
}
function flash(service) {
  const targets = [nodes.get(service), document.querySelector(`[data-edge="${service}"]`)];
  for (const target of targets) if (target) { target.classList.remove('activity'); void target.getBoundingClientRect(); target.classList.add('activity'); setTimeout(() => target.classList.remove('activity'), 1350); }
}
function renderList() {
  text('activity-title', selected ? names[selected] : 'All services');
  document.getElementById('clear-filter').hidden = !selected;
  for (const [service, node] of nodes) { node.classList.toggle('selected', selected === service); node.setAttribute('aria-pressed', String(selected === service)); }
  const filtered = events.filter(event => !selected || event.service === selected).slice(0, 30);
  text('activity-summary', filtered.length ? `${filtered.length} recent recorded operation${filtered.length === 1 ? '' : 's'}${selected ? ` for ${names[selected]}` : ''}. No traffic is simulated.` : 'No recorded operations for this selection yet. Use the workspace to create real activity.');
  const list = document.getElementById('activity-list'); list.replaceChildren();
  if (!filtered.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Waiting for actual service activity. Configuration alone is not a successful API request.'; list.append(li); return; }
  for (const event of filtered) {
    const li = document.createElement('li');
    const time = document.createElement('time'); time.className = 'activity-time'; time.textContent = date(event.at); time.dateTime = event.at || '';
    const service = document.createElement('span'); service.className = 'activity-service'; service.textContent = names[event.service];
    const operation = document.createElement('span'); operation.className = 'activity-operation'; operation.textContent = String(event.operation || 'Operation');
    if (event.detail) { const detail = document.createElement('small'); detail.textContent = String(event.detail); operation.append(detail); }
    const status = document.createElement('span'); status.className = `activity-result ${event.status}`;
    const duration = Number.isFinite(event.durationMs) ? ` · ${event.durationMs >= 1000 ? `${(event.durationMs / 1000).toFixed(1)}s` : `${Math.round(event.durationMs)}ms`}` : '';
    status.textContent = `${event.status}${duration}`;
    li.append(time, service, operation, status); list.append(li);
  }
}
async function poll() {
  if (inFlight || document.visibilityState === 'hidden') return;
  inFlight = true;
  try {
    const response = await fetch('/api/activity', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Activity endpoint returned ${response.status}`);
    const data = await response.json();
    if (data.workspace?.id !== lastWorkspaceId) { firstPoll = true; seen.clear(); lastWorkspaceId = data.workspace?.id; }
    events = (Array.isArray(data.events) ? data.events : []).filter(event => names[event.service] && ['started', 'succeeded', 'failed'].includes(event.status)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    for (const [service, node] of nodes) {
      const latest = events.find(event => event.service === service);
      node.dataset.state = latest?.status || 'idle';
      node.querySelector('.node-status').textContent = latest ? `${latest.status} · ${date(latest.at)}` : staticStatus(service, data.services || {});
    }
    for (const event of events) {
      const key = String(event.id || `${event.at}:${event.service}:${event.operation}`);
      if (!firstPoll && seen.get(key) !== event.status) flash(event.service);
      seen.set(key, event.status);
    }
    if (seen.size > 2000) { const entries = [...seen.entries()].slice(-500); seen.clear(); for (const [key, value] of entries) seen.set(key, value); }
    firstPoll = false;
    document.getElementById('poll-dot').className = 'connected'; text('poll-status', 'Live activity connected');
    text('workspace-label', data.workspace?.mode === 'shared' ? 'Your shared neighborhood session' : 'Your private session');
    text('checked-at', `Checked ${date(new Date().toISOString())} Pacific`); renderList();
  } catch {
    document.getElementById('poll-dot').className = ''; text('poll-status', 'Activity connection unavailable');
    text('checked-at', events.length ? 'Showing the last verified activity snapshot' : 'No API activity has been received');
  } finally { inFlight = false; }
}
for (const [service, node] of nodes) node.addEventListener('click', () => { selected = service; renderList(); document.getElementById('activity-title').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
document.getElementById('clear-filter').addEventListener('click', () => { selected = null; renderList(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void poll(); });
void poll(); setInterval(poll, 2000);
