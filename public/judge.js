const titles = ['Business need & watch', 'A cited agenda match', 'An outreach call', 'Exact brief & consent', 'Two advocates exchange', 'Proposal & human review'];
const shortTitles = ['Need', 'Source', 'Call', 'Consent', 'Advocates', 'Decision'];
const evidence = [
  [{ title: 'Participation on the owner’s schedule', text: 'A fictional business explains one concrete need and chooses what it wants to watch.', kind: 'Simulated owner · no real watch changed' }, { title: 'Clear user experience', text: 'One page, six steps, and a visible boundary between private concerns and shared briefs.', kind: 'Interface demonstration' }],
  [{ title: 'Inspectable grounding', text: 'Search an actual published agenda and retain the original URL, meeting date, item and page.', kind: 'Actual live retrieval when labeled' }, { title: 'No invented future decision', text: 'This example uses an existing published source as a baseline, not a newly published alert.', kind: 'Existing-source baseline' }],
  [{ title: 'Outreach opportunity', text: 'Illustrates a future agenda-triggered outbound notification or call.', kind: 'OUTBOUND CALL SIMULATED' }, { title: 'Actual capability boundary', text: 'Paired inbound calls have been verified separately. No outbound call is placed by this walkthrough.', kind: 'Verified inbound ≠ simulated outbound' }],
  [{ title: 'Conflicting perspectives', text: 'Two fictional AI advocates exchange constraints and counteroffers; their generated dialogue is prepared for replay.', kind: 'AI-generated scenario · simulated businesses' }, { title: 'Consequential coordination', text: 'Watch the delivery/access constraint affect the suggested compromise.', kind: 'Prepared scenario exchange' }],
  [{ title: 'Exact words and explicit consent', text: 'Read or edit the brief before the simulated owner authorizes it. Nothing is sent to the live workspace.', kind: 'SIMULATED OWNER CONSENT' }, { title: 'Human agency', text: 'A permission to share a brief is separate from approving a proposal.', kind: 'Permission boundary demonstrated' }],
  [{ title: 'Version-bound human decisions', text: 'Simulate approval, revise a material term, and see approval reset for the new version.', kind: 'LOCAL SIMULATION ONLY' }, { title: 'Execution evidence', text: 'Actual service operations remain visible below and are not invented by replay.', kind: 'Separate live metadata' }],
];
[evidence[3], evidence[4]] = [evidence[4], evidence[3]];
const criterionMatches = [ ['Potential and Impact', 'User Experience and Design'], ['Use of Real-Time AI and Track Technology', 'Execution and Demo'], ['Originality and Creativity', 'Potential and Impact'], ['User Experience and Design', 'Execution and Demo'], ['Use of Real-Time AI and Track Technology', 'Originality and Creativity'], ['Execution and Demo', 'Potential and Impact'] ];
const serviceNames = { openai: 'OpenAI', relaycast: 'Agent Relay', terse: 'Terse', supabase: 'Supabase', twilio: 'Twilio', freestyle: 'Freestyle', sfmta: 'SFMTA', push: 'Inbox & push' };
let concernsBusy = false, outboundPreference = null, outboundTestInFlight = false, outboundTestRequested = false, outboundTestError = '';
let fixture = null, liveSource = null, sourceState = 'idle', step = 0, shownMessages = 0, callPlayed = false, authorized = false, brief = '', proposal = null, version = 1, decision = 'pending', running = false, playbackTimer = null, discussionTimer = null, activityBusy = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
const words = value => typeof value === 'object' && value ? value.en || '' : String(value || '');
const list = value => Array.isArray(value) ? value.map(words) : [];
function toast(value) { const el = document.getElementById('toast'); el.textContent = value; el.className = 'visible'; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = '', 6500); }
async function api(path, input) { const r = await fetch(path, input ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : { credentials: 'same-origin', cache: 'no-store' }); const data = await r.json(); if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`); return data; }
function capture() { const field = document.getElementById('simulation-brief'); if (field) brief = field.value; }
function reset() { clearTimeout(playbackTimer); clearTimeout(discussionTimer); running = false; step = 0; shownMessages = 0; callPlayed = false; authorized = false; version = 1; decision = 'pending'; brief = words(fixture?.brief); const p = fixture?.proposal?.content?.en || fixture?.proposal || {}; proposal = { title: words(p.title) || 'A proposed neighborhood compromise', terms: list(p.terms), tradeoffs: list(p.tradeoffs), unresolved: list(p.unresolved) }; render(); }
function sourceCard() {
  const source = liveSource || fixture?.source;
  if (!source) return `<div class="source-card"><p>${sourceState === 'loading' ? 'Searching the live published-agenda corpus…' : 'A source has not loaded. No agenda content will be invented.'}</p></div>`;
  const date = source.meetingDate ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(source.meetingDate) ? `${source.meetingDate}T12:00:00Z` : source.meetingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }) : '';
  const url = safeUrl(source.url);
  const excerpt = words(source.excerpt || source.text || source.snippet);
  return `<article class="source-card"><span class="label">${liveSource ? 'ACTUAL LIVE RESULT' : 'PREPARED CITED SOURCE SNAPSHOT'} · EXISTING BASELINE</span><h3>${esc(words(source.title))}</h3><div class="source-meta">${date ? `<span>Meeting · ${esc(date)}</span>` : ''}${source.item ? `<span>Item ${esc(source.item)}</span>` : ''}${source.page ? `<span>Page ${esc(source.page)}</span>` : ''}</div><blockquote>${esc(excerpt.length > 400 ? `${excerpt.slice(0, 400)}…` : excerpt)}</blockquote>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Original official source ↗</a>` : '<p class="small">No original URL available.</p>'}</article>`;
}
function content() {
  if (step === 0) return `<h2>What would make this market work for you?</h2><p>Start with a neighbor's concern, then choose the public decisions worth watching.</p><div class="need-card"><span class="label">FICTIONAL BUSINESS NEED</span><h3>Customers are welcome.<br>Deliveries still need access.</h3><p class="quote">“I want the market to bring people here. But our delivery route needs to stay clear.”</p></div><div class="watch-card"><span class="label">SIMULATED WATCH PROFILE</span><p>Topics this owner would choose to watch:</p><div class="watch-topics"><span>Street closures</span><span>Delivery access</span><span>Evening markets</span></div></div><p class="truth-note">No real visitor profile or agenda watch is created or changed by this step.</p>`;
  if (step === 1) return `<h2>A concern meets public evidence.</h2><p>This card can use an actual live search for “Winter Walk.” The published source remains inspectable.</p>${sourceCard()}<p class="truth-note">This is an existing-source baseline. It is not a claim that an agenda was just published or that officials have decided this fictional market.</p><button class="secondary" data-action="refresh-source">Refresh actual agenda result</button>`;
  if (step === 2) return `<h2>A useful nudge, at the right moment.</h2><p>A matching agenda can invite an owner into the conversation.</p><div class="call-card"><span class="simulation-badge">BROWSER AUDIO PREVIEW · NO PHONE CALL</span><div class="call-icon" aria-hidden="true">☎</div><h3>“Would you like to discuss what it means for your business?”</h3><p class="call-state">English preview · AI-generated voice · existing published source</p><button class="primary" data-action="play-call">${callPlayed ? 'Replay browser audio preview' : 'Play browser audio preview'}</button><audio id="outreach-audio" controls preload="none" src="/demo-outreach-en.mp3" aria-label="Simulated outreach audio preview in English"></audio><details><summary>Read preview transcript</summary><p>This is a simulated CommonGround agenda call. A published item about Winter Walk on Grant Avenue may affect vehicle access. Would you like to discuss what it means for your business?</p></details></div><p class="truth-note">This preview plays through your browser speakers. To make your telephone ring, use “Call my phone with a labeled test” below after saving your own-number preference. A real call plays through your telephone.</p>`;
  if (step === 4) {
    const messages = fixture?.messages || [];
    return `<h2>Two advocates. Different needs.</h2><p>Listen to the constraint, counteroffer and proposed compromise. These business roles and this replay are simulated.</p><div class="discussion-controls"><button class="primary" data-action="play-exchange" ${!fixture || !authorized ? 'disabled' : ''}>${shownMessages ? 'Replay advocate exchange' : 'Play advocate exchange'}</button><span class="small">${shownMessages} / ${messages.length} prepared messages</span></div><ol class="dialogue">${messages.slice(0, shownMessages).map((m, i) => `<li class="message-enter"><span class="message-index">0${i + 1}</span><strong>${esc(m.speaker || m.from || 'Fictional advocate')}</strong><p>${esc(words(m.text || m.message))}</p></li>`).join('')}</ol>${!shownMessages ? '<div class="watch-card"><p>Ready to reveal the prepared back-and-forth.</p></div>' : ''}<p class="truth-note">${fixture?.proof?.model ? `Prepared generation: ${Array.isArray(fixture.proof.openaiCalls) ? fixture.proof.openaiCalls.length : Number(fixture.proof.openaiCalls) || 0} actual ${esc(fixture.proof.model)} responses. ` : ''}${fixture?.proof?.relay?.used ? `${fixture.proof.relay.receipts?.length || 0} actual isolated Relay receipts were recorded. ` : ''}These are prepared results with fictional roles, not fresh model or Relay calls on each replay. The separate live source and API panels may perform actual reads.</p>`;
  }
  if (step === 3) return `<h2>You choose the words that leave.</h2><p>Review the exact brief and simulate an owner's permission to share it. This page never publishes it to a live workspace.</p><div class="consent-card"><label class="field-label" for="simulation-brief">Exact simulated shareable brief</label><textarea id="simulation-brief" maxlength="3000">${esc(brief)}</textarea><label class="check-label"><input id="simulation-consent" type="checkbox"><span>I reviewed this exact text and am simulating the fictional owner's permission to share it.</span></label><button class="primary" data-action="authorize" ${!fixture ? 'disabled' : ''}>Simulate authorization</button>${authorized ? '<p class="consent-result">Simulated brief authorized. Nothing was sent to real advocates or the shared neighborhood.</p>' : ''}</div><p class="truth-note">Authorizing a brief does not approve a proposal. Actual owners retain their own decision.</p>`;
  return `<h2>The final decision belongs to a person.</h2><p>Inspect the proposal, simulate a decision, and change a term to see review reset.</p><article class="proposal-card"><div class="version-label"><span>SIMULATED PROPOSAL · V${version}</span><span class="${decision === 'pending' ? 'pending' : ''}">${decision === 'approved' ? 'Simulated owner approved' : decision === 'rejected' ? 'Simulated owner rejected' : 'Human review pending'}</span></div><h3>${esc(proposal?.title)}</h3><ol class="proposal-terms">${(proposal?.terms || []).map(term => `<li>${esc(term)}</li>`).join('')}</ol>${proposal?.tradeoffs?.length ? `<details><summary>Trade-offs and unresolved issues</summary><ul>${[...proposal.tradeoffs, ...proposal.unresolved].map(term => `<li>${esc(term)}</li>`).join('')}</ul></details>` : ''}</article>${!authorized ? '<p class="truth-note">Simulate exact brief authorization in step 4 before recording this fictional owner decision.</p>' : ''}<label class="check-label"><input id="proposal-reviewed" type="checkbox" ${!authorized ? 'disabled' : ''}><span>I reviewed this exact simulated proposal version.</span></label><div class="decision-controls"><button class="primary" data-action="approve" ${!authorized ? 'disabled' : ''}>Simulate approval of V${version}</button><button class="secondary" data-action="reject" ${!authorized ? 'disabled' : ''}>Simulate rejection</button></div><details class="edit-proposal"><summary>Change a material term and require fresh review</summary><label class="field-label" for="proposal-edit">One term per line</label><textarea id="proposal-edit">${esc((proposal?.terms || []).join('\n'))}</textarea><button class="secondary" data-action="revise">Save simulated V${version + 1}</button></details><p class="truth-note">Only this local simulation changes. Earlier actual-call private/shared proposals and real human decisions remain untouched.</p>`;
}
function render() {
  document.getElementById('step-list').innerHTML = titles.map((title, i) => `<li><button class="step-link ${i === step ? 'current' : i < step ? 'completed' : ''}" data-step="${i}" ${i === step ? 'aria-current="step"' : ''}><span>${i < step ? '✓' : i + 1}</span><span class="step-name">${title}</span></button></li>`).join('');
  document.getElementById('step-number').textContent = `STEP ${step + 1} OF 6`;
  document.getElementById('step-progress').textContent = `${step + 1} / 6`;
  document.getElementById('story-content').innerHTML = content();
  document.getElementById('criterion-evidence').innerHTML = evidence[step].map((item, index) => `<div class="evidence-item"><span class="criterion-match">${esc(criterionMatches[step][index])} · 20%</span><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p><span class="evidence-kind">${esc(item.kind)}</span></div>`).join('');
  document.getElementById('back').disabled = step === 0;
  document.getElementById('next').textContent = step === 5 ? 'Replay story ↺' : 'Next step →';
  document.getElementById('run-all').textContent = running ? 'Pause automatic playback' : 'Run full simulation →';
}
async function searchSource() { if (sourceState === 'loading') return; sourceState = 'loading'; if (step === 1) { capture(); render(); } try { const result = await api('/api/agendas?q=Winter%20Walk&period=past'); liveSource = result.results?.[0] || null; sourceState = liveSource ? 'ready' : 'empty'; } catch { sourceState = 'failed'; toast('Live agenda search unavailable. Any prepared source snapshot stays explicitly labeled.'); } if (step === 1) render(); }
function go(next, automatic = false) { if (next === 4 && !authorized) { toast('Review and authorize the exact simulated brief in step 4 before the advocates exchange it.'); return; } capture(); if (!automatic) { running = false; clearTimeout(playbackTimer); } step = Math.max(0, Math.min(5, next)); render(); if (step === 1 && sourceState === 'idle') void searchSource(); if (step === 4 && authorized) playExchange(); if (!automatic) document.querySelector('.story-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function playExchange() { if (!authorized) return toast('Simulate exact owner consent before playing the advocate exchange.'); clearTimeout(discussionTimer); shownMessages = 0; render(); const reveal = () => { if (step !== 4 || shownMessages >= (fixture?.messages?.length || 0)) return; shownMessages++; render(); discussionTimer = setTimeout(reveal, 1500); }; reveal(); }
function autoPlay() {
  if (running) { running = false; clearTimeout(playbackTimer); render(); return; }
  reset(); running = true; render();
  const advance = () => { if (!running) return; if (step === 5) { running = false; render(); return; } go(step + 1, true); if (step === 2) { callPlayed = true; render(); } if (step === 4 && authorized) playExchange(); if (step === 3) { running = false; render(); toast('Automatic playback pauses before agent exchange for exact simulated owner review. Nothing is silently authorized.'); return; } playbackTimer = setTimeout(advance, step === 4 ? Math.max(7000, (fixture?.messages?.length || 0) * 1500 + 1000) : 4200); };
  playbackTimer = setTimeout(advance, 4200);
}
async function activity() {
  if (activityBusy || document.visibilityState === 'hidden') return; activityBusy = true;
  try {
    const data = await api('/api/activity'); const events = (data.events || []).filter(e => serviceNames[e.service]).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 8);
    document.getElementById('trace-status').textContent = 'Actual activity connected';
    document.getElementById('trace-list').innerHTML = events.length ? events.map(e => `<li><span class="trace-time">${esc(new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles' }))}</span><strong>${esc(serviceNames[e.service])}</strong><span class="trace-operation">${esc(e.operation)}</span><span class="trace-result">${esc(e.status)}${Number.isFinite(e.durationMs) ? ` · ${Math.round(e.durationMs)} ms` : ''}</span></li>`).join('') : '<li>No actual operations recorded yet. Local replay does not invent traffic.</li>';
    const s = data.services || {};
    const statuses = [['OpenAI', s.openaiVerified ? 'Live response verified' : s.openai === 'configured' ? 'Configured' : 'Awaiting status'], ['Agent Relay', s.relay === 'verified' ? 'Receipts verified' : 'Awaiting session receipt'], ['Terse', s.persistence === 'terse-runtime' ? 'Actor runtime selected' : 'Awaiting runtime status'], ['Supabase', s.supabase === 'verified' || s.agendas?.vectorReady ? 'Vector retrieval verified' : 'Awaiting retrieval'], ['Twilio', s.phone?.configured ? 'Inbound configured' : 'Awaiting phone status'], ['Freestyle', location.hostname.endsWith('.style.dev') ? 'Deployment host' : 'Local preview']];
    document.getElementById('service-status').innerHTML = statuses.map(([name, status]) => `<div class="service-row"><strong>${name}</strong><span>${status}</span></div>`).join('');
  } catch { document.getElementById('trace-status').textContent = 'Activity unavailable · no simulation substituted'; }
  finally { activityBusy = false; }
}
document.getElementById('back').addEventListener('click', () => go(step - 1));
document.getElementById('next').addEventListener('click', () => step === 5 ? reset() : go(step + 1));
document.getElementById('replay').addEventListener('click', () => { reset(); toast('Only the local simulation was reset.'); });
document.getElementById('run-all').addEventListener('click', autoPlay);
document.getElementById('step-list').addEventListener('click', event => { const button = event.target.closest('[data-step]'); if (button) go(Number(button.dataset.step)); });
document.getElementById('story-content').addEventListener('input', event => { if (event.target.id === 'simulation-brief') { brief = event.target.value; authorized = false; decision = 'pending'; document.querySelector('.consent-result')?.remove(); } });
document.getElementById('story-content').addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'refresh-source') void searchSource();
  if (action === 'play-call') {
    callPlayed = true; render();
    const preview = document.getElementById('outreach-audio');
    preview.currentTime = 0;
    void preview.play().catch(() => toast('Use the audio player’s play control and check your browser volume. This preview does not dial your phone.'));
  }
  if (action === 'play-exchange') playExchange();
  if (action === 'authorize') { capture(); if (!document.getElementById('simulation-consent')?.checked || !brief.trim()) return toast('Review the exact brief and check simulated consent first.'); authorized = true; render(); toast('Local simulated consent only. No real brief was sent.'); }
  if (action === 'approve' || action === 'reject') { if (!authorized || !document.getElementById('proposal-reviewed')?.checked) return toast('Review this exact simulated version before deciding.'); decision = action === 'approve' ? 'approved' : 'rejected'; render(); }
  if (action === 'revise') { if (!proposal) return toast('The prepared scenario has not loaded yet.'); const terms = document.getElementById('proposal-edit').value.split('\n').map(v => v.trim()).filter(Boolean); if (!terms.length) return toast('Keep at least one concrete term.'); if (terms.join('\n') === proposal.terms.join('\n')) return toast('Change a material term before making a new version.'); proposal.terms = terms; version++; decision = 'pending'; render(); toast(`Simulated V${version} needs fresh human review. Prior approval did not carry forward.`); }
});
document.getElementById('real-pair').addEventListener('click', async () => {
  const button = document.getElementById('real-pair'); button.disabled = true;
  try { const result = await api('/api/phone/pair', { participant: 'garage', language: 'en', spokenLanguage: document.getElementById('real-language').value }); const phone = String(result.phoneNumber || ''); const digits = phone.replace(/\D/g, ''); const formatted = /^1\d{10}$/.test(digits) ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}` : phone; document.getElementById('real-pair-result').innerHTML = `<p>Actual workspace pairing code. Enter it first on the phone keypad:</p><strong class="actual-code">${esc(result.code)}</strong>${/^\+?[\d ()-]{7,22}$/.test(phone) ? `<a class="actual-phone" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">${esc(formatted)}</a>` : ''}<p class="small">If asked for language: 1 English · 2 粵語 · 3 Shqip · 0 Auto. This is a real inbound option; the simulated outbound story above places no call.</p>`; }
  catch (error) { document.getElementById('real-pair-result').textContent = error.message; }
  finally { button.disabled = false; }
});
render(); void activity(); void actualConcerns(); void loadOutbound(); setInterval(activity, 2000); setInterval(actualConcerns, 5000);
try { const result = await fetch('/judge-simulation.json', { cache: 'no-store' }); if (!result.ok) throw new Error('Prepared scenario is not available yet.'); fixture = await result.json(); if (fixture.simulation !== true) throw new Error('Scenario must be explicitly marked as a simulation.'); reset(); document.getElementById('load-status').textContent = 'Prepared fictional scenario ready · no real owner consent'; document.getElementById('run-all').disabled = false; }
catch (error) { document.getElementById('load-status').textContent = `${error.message} Navigation and actual source/activity checks remain available.`; }

async function actualConcerns() {
  if (concernsBusy || document.visibilityState === 'hidden') return; concernsBusy = true;
  try {
    const data = await api('/api/state'); const shared = data.workspace?.mode === 'shared'; const contributors = data.contributors || [];
    document.getElementById('actual-concerns-title').textContent = shared ? 'Authorized neighborhood concerns' : 'Your authorized concerns';
    document.getElementById('concerns-status').textContent = `${contributors.length} authorized · ${shared ? 'shared neighborhood' : 'private workspace'}`;
    document.getElementById('actual-concerns-scope').textContent = shared ? 'Only reviewed briefs authorized for this neighborhood are visible. Raw calls and unapproved drafts are not listed.' : 'These exact authorized briefs stay inside your private workspace. Nothing is automatically published to the shared neighborhood.';
    document.getElementById('actual-concerns-list').innerHTML = contributors.length ? contributors.map(c => {
      const contributorId = c.visitorId || c.id;
      const receipts = (data.exchanges || []).filter(receipt => {
        const payload = receipt.payload || {};
        return receipt.verified === true && receipt.transport === 'relaycast' && payload.kind === 'authorized-brief' && payload.contributorId === contributorId && payload.brief === c.brief && (!c.intentId || payload.authorizationId === c.intentId);
      });
      const verifiedTargets = new Set(receipts.map(receipt => receipt.to));
      const expectedTargets = (data.participants || []).filter(person => person.id !== c.perspective).length || 2;
      const confirmed = verifiedTargets.size >= expectedTargets;
      const status = confirmed ? `Brief shared · ${verifiedTargets.size} verified Relay receipts` : verifiedTargets.size ? `Authorized brief · ${verifiedTargets.size}/${expectedTargets} verified receipts visible` : 'Authorized brief · current Relay receipts not visible';
      const when = c.sharedAt ? new Date(c.sharedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '';
      return `<article class="actual-concern"><div class="concern-receipt-status ${confirmed ? 'confirmed' : 'unconfirmed'}">${esc(status)}</div><strong>${esc(c.displayName || 'Demo visitor')}</strong><p>${esc(c.brief || '')}</p><div class="concern-share-audience">Audience: ${shared ? 'this shared neighborhood' : 'advocates in your private demo'}${when ? ` · Authorized ${esc(when)} Pacific` : ''}</div><p class="concern-share-boundary">This shares a brief with advocates. It does not file anything with government or approve a proposal.</p></article>`;
    }).join('') : '<p class="small">No authorized concerns in this workspace yet. A local simulated consent above does not create a real contribution.</p>';
  } catch { document.getElementById('concerns-status').textContent = 'Actual list unavailable · no simulated content substituted'; }
  finally { concernsBusy = false; }
}
async function loadOutbound() {
  try {
    outboundPreference = await api('/api/outbound-preferences');
    const terminalTests = ['completed', 'failed', 'canceled', 'cancelled', 'busy', 'no-answer'];
    if (outboundTestRequested && outboundPreference.testRetryBlocked === false && terminalTests.includes(outboundPreference.lastTestStatus) && Number(outboundPreference.testsLastHour || 0) < Number(outboundPreference.maxTestsPerHour || 3)) { outboundTestRequested = false; document.getElementById('outbound-test-consent').checked = false; }
    document.getElementById('outbound-status').textContent = outboundPreference.enabled ? 'Real agenda-call watch enabled' : 'Not opted in';
    document.getElementById('outbound-result').textContent = outboundPreference.eligible ? `Recent paired number verified${outboundPreference.maskedPhone ? ` · ${outboundPreference.maskedPhone}` : ''}. Configuration is not proof of a delivered outbound call.` : 'First complete a real code-paired inbound call from your own number. No number is called by this page automatically.';
    document.getElementById('save-outbound').disabled = !outboundPreference.eligible;
    updateTestButton();
    if (['en','yue','sq'].includes(outboundPreference.language)) document.getElementById('outbound-language').value = outboundPreference.language;
  } catch { outboundPreference = null; document.getElementById('outbound-status').textContent = 'Outbound opt-in awaiting server availability'; document.getElementById('save-outbound').disabled = true; updateTestButton(); }
}
document.getElementById('outbound-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!document.getElementById('outbound-consent').checked) return toast('Explicitly confirm your own number and future agenda-call consent first.');
  const button = document.getElementById('save-outbound'); button.disabled = true;
  try { await api('/api/outbound-preferences', { enabled: true, phoneNumber: document.getElementById('outbound-number').value.trim(), language: document.getElementById('outbound-language').value, consent: true }); document.getElementById('outbound-consent').checked = false; document.getElementById('outbound-number').value = ''; await loadOutbound(); toast('Future agenda-call preference saved. No call was placed by saving.'); }
  catch (error) { document.getElementById('outbound-result').textContent = error.message; }
  finally { button.disabled = !outboundPreference?.eligible; }
});
document.getElementById('disable-outbound').addEventListener('click', async () => { try { await api('/api/outbound-preferences', { enabled: false }); await loadOutbound(); toast('Future agenda calls turned off.'); } catch (error) { document.getElementById('outbound-result').textContent = error.message; } });

function updateTestButton() {
  const button = document.getElementById('outbound-test');
  if (button) button.disabled = outboundTestInFlight || outboundTestRequested || outboundPreference?.testRetryBlocked === true || Number(outboundPreference?.testsLastHour || 0) >= Number(outboundPreference?.maxTestsPerHour || 3) || !outboundPreference?.eligible || !outboundPreference?.enabled || !document.getElementById('outbound-test-consent')?.checked;
  const result = document.getElementById('outbound-test-result');
  if (result && !outboundTestInFlight && !outboundTestRequested) {
    result.textContent = outboundTestError || (!outboundPreference?.eligible
      ? 'This browser workspace needs a recent code-paired inbound call from your own number before it can call you.'
      : outboundPreference?.testRetryBlocked === true
        ? 'The previous test is still active or its status is unknown. Wait for a terminal status, then refresh; no automatic retry will occur.'
        : Number(outboundPreference?.testsLastHour || 0) >= Number(outboundPreference?.maxTestsPerHour || 3)
          ? 'The manual test limit is reached: up to three explicitly requested tests per hour. Automatic agenda calls retain their separate daily limit.'
      : !outboundPreference?.enabled
        ? 'Save your preference with “Enable future agenda calls” above first. If saving fails, its error appears just above this test panel. No call has been requested.'
        : !document.getElementById('outbound-test-consent')?.checked
          ? 'Your number is enabled. Check the one-call test confirmation to make the call button available.'
          : 'Ready to call your saved own number once. Your fresh pairing code will appear here when you request the call.');
  }
}
document.getElementById('outbound-test-consent').addEventListener('change', () => { outboundTestError = ''; updateTestButton(); });
document.getElementById('refresh-outbound').addEventListener('click', loadOutbound);
document.getElementById('outbound-test').addEventListener('click', async () => {
  if (outboundTestInFlight || outboundTestRequested || outboundPreference?.testRetryBlocked === true || Number(outboundPreference?.testsLastHour || 0) >= Number(outboundPreference?.maxTestsPerHour || 3) || !outboundPreference?.eligible || !outboundPreference?.enabled || !document.getElementById('outbound-test-consent').checked) return;
  outboundTestError = ''; outboundTestInFlight = true; updateTestButton();
  document.getElementById('outbound-test-result').textContent = 'Requesting your explicitly confirmed labeled test. No answered outcome is inferred.';
  try {
    const result = await api('/api/outbound-test', { confirmTest: true });
    outboundTestRequested = true; document.getElementById('outbound-test-consent').checked = false;
    const pairing = result.pairing || result; const code = String(pairing.code || result.code || '');
    if (/^\d{6}$/.test(code)) {
      document.getElementById('outbound-test-code').textContent = code;
      document.getElementById('outbound-test-pairing').hidden = false;
      document.getElementById('outbound-test-expiry').textContent = pairing.expiresAt ? `Expires ${new Date(pairing.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Use this code only for the test you just requested.';
    }
    document.getElementById('outbound-test-result').textContent = result.status === 'unknown' ? 'The server could not confirm whether the test request completed. Check your phone and current status before trying anything else; no automatic retry will occur.' : 'Labeled test requested using an existing cited document, not a new publication. Requested/queued does not mean answered. Check your phone.';
  } catch (error) {
    document.getElementById('outbound-test-consent').checked = false;
    outboundTestError = `${error.message} No automatic retry will occur.`;
    document.getElementById('outbound-test-result').textContent = outboundTestError;
  } finally { outboundTestInFlight = false; updateTestButton(); }
});

// Private watch editing is independent of simulation replay and remote inbox refresh.
let judgeWatchDirty = false, judgeWatchSaving = false, judgeWatchEditVersion = 0, judgeInboxLoading = false;
function watchDate(value, includeTime = false) {
  if (!value) return 'Not supplied';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00Z` : value;
  const date = new Date(normalized); if (Number.isNaN(date.getTime())) return 'Not supplied';
  return includeTime ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }) : date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'America/Los_Angeles' });
}
function fillJudgeWatch(watch) {
  document.getElementById('judge-watch-needs').value = watch?.needs || '';
  document.getElementById('judge-watch-streets').value = Array.isArray(watch?.streets) ? watch.streets.join(', ') : '';
  document.getElementById('judge-watch-enabled').checked = Boolean(watch?.enabled);
}
function showJudgeAlerts(response) {
  const alerts = Array.isArray(response?.alerts) ? response.alerts : [];
  document.getElementById('judge-agenda-alerts').innerHTML = alerts.length ? alerts.map(alert => {
    const label = alert.test ? 'TEST · existing document' : alert.baseline ? 'Existing baseline' : 'New match';
    const url = safeUrl(alert.url || alert.sourceUrl);
    return `<article class="judge-agenda-alert"><span class="alert-kind ${alert.test ? 'test' : alert.baseline ? 'baseline' : 'new'}">${label}</span><h4>${esc(words(alert.title))}</h4>${alert.reason ? `<p class="small">${esc(words(alert.reason))}</p>` : ''}${alert.text ? `<details><summary>Read public agenda excerpt</summary><p class="agenda-alert-excerpt">${esc(words(alert.text))}</p></details>` : ''}<div class="alert-dates"><span>Meeting: ${esc(watchDate(alert.meetingDate))}</span><span>Discovered: ${esc(watchDate(alert.createdAt, true))}${alert.createdAt ? ' Pacific' : ''}</span>${alert.item ? `<span>Item ${esc(alert.item)}</span>` : ''}${alert.page ? `<span>Page ${esc(alert.page)}</span>` : ''}</div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Original public source ↗</a>` : '<p class="small">Original source link unavailable.</p>'}</article>`;
  }).join('') : '<p class="small">No matching alerts yet. Save a watch to find existing baseline matches; only future new relevant publications can trigger separately opted-in calls.</p>';
}
async function loadJudgeWatch(inboxOnly = false) {
  if (judgeInboxLoading) return; judgeInboxLoading = true;
  const requestEditVersion = judgeWatchEditVersion;
  const requests = inboxOnly ? [api('/api/agenda-alerts')] : [api('/api/agenda-watch'), api('/api/agenda-alerts')];
  const results = await Promise.allSettled(requests);
  try {
    if (!inboxOnly) {
      if (results[0].status === 'fulfilled' && !judgeWatchDirty && !judgeWatchSaving && judgeWatchEditVersion === requestEditVersion) { const r = results[0].value; const watch = Object.hasOwn(r, 'watch') ? r.watch : r; fillJudgeWatch(watch); document.getElementById('judge-watch-status').textContent = watch?.enabled ? 'Your saved private watch is enabled. No call was placed by loading it.' : 'Watch is not enabled. Enter your needs and explicitly save when ready.'; }
      else if (results[0].status === 'rejected') document.getElementById('judge-watch-status').textContent = results[0].reason.message;
    }
    const inbox = results[inboxOnly ? 0 : 1];
    if (inbox.status === 'fulfilled') showJudgeAlerts(inbox.value);
    else document.getElementById('judge-agenda-alerts').textContent = inbox.reason.message || 'Your inbox is temporarily unavailable.';
  } finally { judgeInboxLoading = false; }
}
for (const id of ['judge-watch-needs', 'judge-watch-streets', 'judge-watch-enabled']) {
  const field = document.getElementById(id);
  const mark = () => { judgeWatchDirty = true; judgeWatchEditVersion++; document.getElementById('judge-watch-status').textContent = 'Unsaved changes. Inbox refresh will not overwrite what you are editing.'; };
  field.addEventListener('input', mark); field.addEventListener('change', mark);
}
document.getElementById('judge-watch-form').addEventListener('submit', async event => {
  event.preventDefault(); if (judgeWatchSaving) return;
  const editVersion = judgeWatchEditVersion;
  const payload = { needs: document.getElementById('judge-watch-needs').value.trim(), streets: document.getElementById('judge-watch-streets').value.split(/[,，]/).map(value => value.trim()).filter(Boolean), enabled: document.getElementById('judge-watch-enabled').checked, language: 'en' };
  if (payload.needs.length < 3) return toast('Describe your needs in at least three characters.');
  judgeWatchSaving = true; document.getElementById('judge-watch-save').disabled = true;
  try {
    const response = await api('/api/agenda-watch', payload);
    if (judgeWatchEditVersion === editVersion) { judgeWatchDirty = false; fillJudgeWatch(response.watch || response); document.getElementById('judge-watch-status').textContent = 'Private agenda watch saved. Existing matches are baseline; saving did not place a call.'; }
    else document.getElementById('judge-watch-status').textContent = 'Earlier values saved. Your newer edits remain unsaved and have been preserved.';
    await loadJudgeWatch(true);
  } catch (error) { document.getElementById('judge-watch-status').textContent = error.message; }
  finally { judgeWatchSaving = false; document.getElementById('judge-watch-save').disabled = false; }
});
document.getElementById('judge-watch-refresh').addEventListener('click', () => { void loadJudgeWatch(); });
void loadJudgeWatch();
setInterval(() => { if (document.visibilityState !== 'hidden') void loadJudgeWatch(true); }, 15000);
