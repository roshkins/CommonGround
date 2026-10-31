import { createFeatures } from './features.js';
const app = document.querySelector('#app');
const ui = {
  en: {
    reviewingAs: 'Reviewing as this fictional owner', tagline: 'Every neighbor, heard.', workspace: 'Neighborhood workspace', demo: 'Fictional businesses · Demo only',
    advocate: 'Your advocate', proposal: 'Shared proposal', evidence: 'Evidence', connections: 'Connections',
    eyebrow: 'CHINATOWN / A STREET MARKET CONVERSATION', headline: 'A shared street.', headline2: 'A voice for everyone.',
    intro: 'Different needs. Different languages. A way forward, together.', neighbors: 'neighbors', languages: 'UI languages', sharedDraft: 'shared draft',
    yourNeighbors: 'YOUR NEIGHBORS', switch: 'Choose a demo owner to represent', fictional: 'These are fictional personas. Switching profiles does not authenticate a real owner.',
    private: 'Private to your advocate', shared: 'Brief authorized', noBrief: 'Not shared yet', pending: 'Awaiting review', approved: 'Demo approval', rejected: 'Rejected', revise: 'Changes requested', outdated: 'Review needed',
    step1: 'Talk', step2: 'Authorize', step3: 'Explore', step4: 'Review',
    talking: 'You’re speaking for', language: 'Your language', speak: 'What would make this market work for you?',
    speakHelp: 'Tell your advocate what you hope for, what worries you, and what needs to stay possible.',
    placeholder: '“I want more people in the neighborhood, but our deliveries need access…”', seed: 'Use this owner’s demo concern',
    record: 'Record a concern', stop: 'Stop & transcribe', transcribing: 'Transcribing…', voiceHelp: 'Audio goes to OpenAI for transcription when you stop. Review the transcript before continuing.',
    voiceUnavailable: 'Add an OpenAI key for voice. Text works in rehearsal.', understand: 'Help my advocate understand',
    rehearsal: 'Scripted rehearsal', live: 'Live OpenAI', aiMode: 'AI mode', messageTransport: 'Message transport', aiHelp: 'Rehearsal echoes your input and uses illustrative counteroffers. It does not generate AI answers.',
    checkUnderstanding: 'Did I understand you?', understoodHelp: 'Your advocate’s draft is private. Edit the shareable brief below before allowing any exchange.',
    goal: 'What matters to you', constraints: 'Conditions to protect', question: 'A question to consider', original: 'Original owner wording',
    permission: 'You choose what leaves this conversation.', brief: 'The exact brief other advocates may receive',
    consent: 'I reviewed this text and authorize sharing this brief with the other demo advocates.', authorize: 'Authorize this brief',
    authorizedHelp: 'Only this reviewed brief can enter the negotiation. Raw concerns are kept out of the exchange.',
    next: 'Next neighbor', allReady: 'Your concern can shape an option.', allReadyHelp: 'Advocates compare authorized concerns with clearly labeled scenario context, then bring back a concrete option.',
    negotiate: 'Explore a compromise', renegotiate: 'Draft a new option', relay: 'Actual Agent Relay transport', simulatedTransport: 'Simulated local exchange',
    transportHelp: 'Actual transport requires the local Relay engine. Simulated exchange is labeled and does not use Relay.',
    sharedSpace: 'THE SHARED SPACE', emptyTitle: 'A proposal starts with listening.', emptyHelp: 'Let each neighbor review a brief. Then their advocates can find an option worth bringing back.',
    briefsReady: 'briefs authorized', noApproval: 'Agents propose. People approve.', localSave: 'Saved in your session',
    current: 'Current proposal', version: 'Version', terms: 'Proposed terms', tradeoffs: 'What we trade off', unresolved: 'Still to resolve',
    evidenceUsed: 'Reported context', approvalTitle: 'A decision belongs to its owner.', reviewBox: 'I reviewed this exact proposal version and am recording a decision for this fictional owner.',
    approve: 'Approve as demo owner', reject: 'Reject this version', request: 'Request changes', note: 'Explain your decision or the change you need',
    decisionSaved: 'Demo decision saved for this version.', noConsensus: 'Owner approval is still incomplete.', allApproved: 'All three demo owners approved this version.',
    demoOnly: 'Demo decisions are recorded by the person operating these profiles. They are not real business consent and nothing has been submitted.',
    stale: 'An authorized brief changed. Draft a new option before anyone approves.',
    manualEdit: 'Revise a material term', manualHelp: 'A new version clears prior approvals. Live revisions are prepared in both languages for every owner to review.',
    editPlaceholder: 'Describe the changed term…', newVersion: 'Save a new proposal version', export: 'Download demo proposal', translationPending: 'This manual rehearsal addition needs bilingual review. Generate a live option before approving.',
    exchangeTitle: 'Between the advocates', exchangeHelp: 'Only authorized information crosses this boundary.', noExchange: 'No messages exchanged yet.', verified: 'Receipt verified', simulated: 'Simulated', asking: 'Asking the neighbor’s advocate…', replying: 'Receiving a counteroffer…', drafting: 'Weighing the trade-offs…',
    evidenceTitle: 'Evidence, with its edges intact.', evidenceIntro: 'Public reporting gives context. The businesses, constraints, and compromise in this demo are invented.',
    reported: 'Reported context', source: 'Read the source', sourceMeta: 'Wind Newspaper · Portia Li · April 29, 2024',
    demoConstraints: 'What we invented for this demo', invented: 'Lantern Tea, Pacific Garage, and Jade & Paper are fictional. A 6 pm start, a 9 pm music cutoff, and a two-event trial are proposed demo terms—not permit requirements.',
    evidenceLimit: 'This is a curated reporting set, not a complete hearing archive. City feasibility and permitting remain unresolved.',
    connectionTitle: 'What is actually connected', keyConfigured: 'Key detected · live request not yet verified', keyVerified: 'Live response verified', checking: 'Checking conditions and translations…', keyMissing: 'No local key yet', relayVerified: 'Messages verified through Relaycast', relayUnverified: 'No verified exchange yet',
    localDb: 'Local SQLite · active', notConnected: 'Not connected', configuredOnly: 'Values detected · not connected',
    setup: 'Put keys in the local .env file and save. The server reloads values automatically. Do not enter secrets in this page.',
    terseHelp: 'Connection values alone do not verify a live service. Shared briefs and decisions are stored by this server; agenda sources show their own retrieval status.',
    close: 'Close', refresh: 'Refresh status', newSession: 'Start a fresh demo', archiveHelp: 'The current demo is archived locally before a fresh one starts.',
    footer: 'People decide. Advocates help them get there.', footerRight: 'Common Ground / Haunted Hacks 2026',
    working: 'Working…', saved: 'Saved', error: 'Something needs attention', reviewed: 'Reviewed brief shared', consentNeeded: 'Review and check the permission box first.',
    recording: 'Recording… click stop when you finish.', micError: 'Microphone unavailable or permission declined. You can type your concern.',
    liveMissing: 'Add OPENAI_API_KEY in .env and save, then refresh status.', stepHint: 'A little listening goes a long way.',
    scope: 'Civic proposals only. Commercial coordination on prices, wages, customers, or market allocation is excluded.',
  },
  'zh-Hant': {
    reviewingAs: '以這位虛構店主身份審閱', checking: '正在核對條件及翻譯……', keyVerified: '已驗證即時回應',
    tagline: '讓每位鄰里都被聽見。', workspace: '鄰里工作區', demo: '虛構商戶 · 僅供示範',
    advocate: '你的倡議助手', proposal: '共同方案', evidence: '資料依據', connections: '服務連線',
    eyebrow: '唐人街 / 一場街市對話', headline: '共同的街道。', headline2: '每個人的聲音。',
    intro: '不同需要，不同語言，一起尋找前進的方向。', neighbors: '位鄰里', languages: '種介面語言', sharedDraft: '份共同草案',
    yourNeighbors: '你的鄰里', switch: '選擇要代表的示範店主', fictional: '這些是虛構角色。切換檔案並不代表真實店主的身份認證。',
    private: '只有你的助手可見', shared: '已授權摘要', noBrief: '尚未分享', pending: '等待審閱', approved: '示範批准', rejected: '已拒絕', revise: '要求修改', outdated: '需要重新審閱',
    step1: '表達', step2: '授權', step3: '探索', step4: '審閱',
    talking: '你現在代表', language: '你的語言', speak: '怎樣的街市安排才適合你？',
    speakHelp: '告訴助手你的期望、顧慮，以及必須保留的安排。', placeholder: '「我希望社區有更多人流，但送貨車需要通行……」', seed: '使用此店主的示範意見',
    record: '錄下你的意見', stop: '停止並轉為文字', transcribing: '正在轉錄……', voiceHelp: '停止錄音後，音訊會傳送給 OpenAI 轉錄。繼續前請核對文字。', voiceUnavailable: '加入 OpenAI 金鑰後可使用語音。示範模式可輸入文字。',
    understand: '讓助手理解我的需要', rehearsal: '腳本演練', live: '即時 OpenAI', aiMode: 'AI 模式', messageTransport: '訊息傳輸', aiHelp: '演練模式會重述你的原文，並使用示範回覆，不會產生 AI 答案。',
    checkUnderstanding: '我的理解正確嗎？', understoodHelp: '助手的草稿是私人的。允許交流前，請編輯下方可分享的摘要。', goal: '你重視的事', constraints: '需要保障的條件', question: '值得考慮的問題', original: '店主原文',
    permission: '由你決定哪些內容可以分享。', brief: '其他助手可以收到的確切摘要', consent: '我已審閱此文字，並授權與其他示範助手分享這份摘要。', authorize: '授權分享摘要', authorizedHelp: '只有這份已審閱的摘要會進入協商。原始意見不會傳給其他助手。',
    next: '下一位鄰里', allReady: '讓你的意見影響方案。', allReadyHelp: '助手會比較已授權意見及清楚標示的情境背景，再帶回一個具體方案。', negotiate: '探索折衷方案', renegotiate: '起草新方案', relay: '實際 Agent Relay 傳輸', simulatedTransport: '本機模擬交流', transportHelp: '實際傳輸需要啟動本機 Relay 引擎。模擬交流會清楚標示，且不會使用 Relay。',
    sharedSpace: '共同空間', emptyTitle: '好的方案，從聆聽開始。', emptyHelp: '讓每位鄰里審閱摘要，然後由助手尋找值得帶回討論的方案。', briefsReady: '份摘要已授權', noApproval: '助手提議，由人批准。', localSave: '已儲存在你的工作階段',
    current: '目前方案', version: '版本', terms: '建議條款', tradeoffs: '需要取捨的地方', unresolved: '尚待解決', evidenceUsed: '報道背景', approvalTitle: '決定權，屬於店主。', reviewBox: '我已審閱此版本，並為這位虛構店主記錄決定。', approve: '以示範店主身份批准', reject: '拒絕此版本', request: '要求修改', note: '說明你的決定或需要的修改',
    decisionSaved: '已為此版本儲存示範決定。', noConsensus: '仍未獲得全部店主批准。', allApproved: '三位示範店主已批准此版本。', demoOnly: '示範決定由操作這些檔案的人記錄，不代表真實商戶同意，也未提交任何內容。', stale: '已授權的摘要有變。請先起草新方案，再讓店主批准。',
    manualEdit: '修改重要條款', manualHelp: '新版本會清除先前的批准。即時模式會準備雙語修訂，供每位店主重新審閱。', editPlaceholder: '描述修改後的條款……', newVersion: '儲存為新的方案版本', export: '下載示範方案', translationPending: '演練模式的手動新增內容需要雙語審閱。請先產生即時雙語方案後再批准。',
    exchangeTitle: '助手之間的對話', exchangeHelp: '只有已授權的資訊會跨越這個界線。', noExchange: '尚未交換訊息。', verified: '已驗證收件', simulated: '模擬', asking: '正在詢問鄰里的助手……', replying: '正在接收折衷建議……', drafting: '正在權衡取捨……',
    evidenceTitle: '資料依據，保留其界限。', evidenceIntro: '公開報道提供背景。示範中的商戶、條件及折衷方案均為虛構。', reported: '報道背景', source: '閱讀原文', sourceMeta: 'Wind Newspaper · 李秀蘭 · 2024年4月29日',
    demoConstraints: '我們為示範而設定的內容', invented: 'Lantern Tea、Pacific Garage、Jade & Paper 都是虛構商戶。下午六點開始、晚上九點停止音樂、試辦兩次，是示範建議條款，不是許可要求。', evidenceLimit: '這是精選報道資料，並非完整聽證會檔案。市府可行性評估及許可仍待確認。',
    connectionTitle: '實際連線狀態', keyConfigured: '已偵測到金鑰 · 尚未驗證即時請求', keyMissing: '尚未加入本機金鑰', relayVerified: '已透過 Relaycast 驗證訊息', relayUnverified: '尚未驗證任何交流', localDb: '本機 SQLite · 使用中', notConnected: '尚未連線', configuredOnly: '已偵測設定 · 尚未連線', setup: '在本機 .env 檔案填入金鑰並儲存。伺服器會自動重新讀取。請勿在此頁輸入秘密資料。', terseHelp: '只有連線設定，並不代表已驗證即時服務。此伺服器儲存共享摘要及決定；議程來源會顯示各自的檢索狀態。', close: '關閉', refresh: '更新狀態', newSession: '開始新的示範', archiveHelp: '開始新示範前，目前內容會先在本機封存。',
    footer: '由人決定，讓助手協助找到方向。', footerRight: 'Common Ground / Haunted Hacks 2026', working: '處理中……', saved: '已儲存', error: '有內容需要處理', reviewed: '已分享審閱後的摘要', consentNeeded: '請先審閱並勾選許可方框。', recording: '錄音中……完成後請按停止。', micError: '無法使用麥克風，或未獲許可。你仍可輸入文字。', liveMissing: '請在 .env 加入 OPENAI_API_KEY 並儲存，然後更新狀態。', stepHint: '多聽一點，就能走近一點。', scope: '僅限公共事務方案。不可協調價格、工資、客戶或市場分配。',
  },
};
const icons = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', check: '<path d="m5 12 4 4L19 6"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  tea: '<path d="M5 9h12v6a6 6 0 0 1-12 0V9Zm12 1h2a3 3 0 1 1-2 5M8 3v2m5-2v2M4 22h15"/>',
  garage: '<path d="m3 10 9-7 9 7v12H3V10Zm4 12V12h10v10M7 16h10M7 19h10"/>',
  craft: '<path d="M4 5h16v16H4zM8 5V2m8 3V2M4 10h16m-11 5 2 2 4-4"/>',
  leaf: '<path d="M19 3C8 2 3 8 5 15s14 7 14-12ZM5 20 15 9"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  link: '<path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 4a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-2 2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = localStorage.getItem('cg-language') || 'en'; if (!ui[lang]) lang = 'en';
let selected = localStorage.getItem('cg-participant') || 'tea';
let state, view = new URLSearchParams(location.search).get('view') === 'evidence' ? 'evidence' : 'advocate', mode = 'rehearsal', transport = 'relaycast', busy = false, stage = '', showConnections = false;
let inputCache = {}, briefCache = {}, recorder = null, recorderStream = null, recording = false;
const dirtyConcerns = new Set(), dirtyBriefs = new Set(), decisionNotes = {}, revisionNotes = {};
let privateRefreshPending = false, privateRefreshRunning = false;
const t = key => ui[lang][key] || ui.en[key] || key;
const self = () => state.participants.find(p => p.id === selected) || state.participants[0];
const badge = (text, cls = '') => `<span class="badge ${cls}">${esc(text)}</span>`;
const disabled = condition => condition ? 'disabled' : '';
const action = (name, label, cls = '', condition = false, extra = '') => `<button type="button" data-action="${name}" class="${cls}" ${disabled(condition || busy)} ${extra}>${label}</button>`;

async function api(path, input) {
  const response = await fetch(path, input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function toast(message, error = false) {
  const box = document.querySelector('#toast'); box.textContent = message; box.className = error ? 'visible error' : 'visible';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { box.className = ''; }, error ? 14000 : 4500);
}
function capture() {
  const concern = document.querySelector('#concern'); if (concern) inputCache[selected] = concern.value;
  const brief = document.querySelector('#brief'); if (brief) briefCache[selected] = { draftId: state.self.draft?.id, text: brief.value };
  const noteKey = `${state?.id}:${state?.proposal?.version}:${selected}`;
  const decisionNote = document.querySelector('#decision-note'); if (decisionNote) decisionNotes[noteKey] = decisionNote.value;
  const revisionNote = document.querySelector('#revision-note'); if (revisionNote) revisionNotes[noteKey] = revisionNote.value;
}
async function refresh() {
  state = await api(`/api/state?participant=${encodeURIComponent(selected)}`);
  if (!state.participants.some(p => p.id === selected)) selected = 'tea';
}
async function mutate(path, payload, success) {
  capture(); busy = true; render();
  try {
    state = await api(path, { participant: selected, revision: state.revision, ...payload });
    if (success) toast(success);
    return true;
  } catch (error) { toast(error.message, true); try { await refresh(); } catch {} return false; }
  finally { busy = false; stage = ''; render(); if (privateRefreshPending) queueMicrotask(refreshPrivateUpdates); }
}
async function refreshPrivateUpdates() {
  if (!privateRefreshPending || privateRefreshRunning || busy || recording) return;
  privateRefreshPending = false; privateRefreshRunning = true;
  capture();
  const activeField = document.activeElement;
  const focus = activeField?.id ? { id: activeField.id, start: activeField.selectionStart, end: activeField.selectionEnd } : null;
  const oldDraftId = state.self.draft?.id;
  const oldBrief = dirtyBriefs.has(selected) ? briefCache[selected]?.text : undefined;
  try {
    await refresh();
    const changed = oldDraftId !== state.self.draft?.id;
    if (changed && !dirtyConcerns.has(selected)) delete inputCache[selected];
    if (changed && oldBrief !== undefined) briefCache[selected] = { draftId: state.self.draft?.id, text: oldBrief };
    render();
    if (focus) {
      const field = document.getElementById(focus.id);
      if (field && !field.disabled) { field.focus({ preventScroll: true }); if (typeof field.setSelectionRange === 'function' && focus.start != null) field.setSelectionRange(focus.start, focus.end); }
    }
    if (changed) toast(lang === 'zh-Hant' ? '已更新電話對話內容。未送出的文字仍保留；分享前請重新審閱。' : 'Your call update is ready. Unsent text is preserved; review again before sharing.');
  } catch (error) { toast(error.message, true); }
  finally { privateRefreshRunning = false; if (privateRefreshPending) queueMicrotask(refreshPrivateUpdates); }
}
function statusFor(id) { return state.approvals.find(a => a.participant === id)?.status || 'pending'; }
function exchangeText(exchange) {
  const payload = exchange.payload || {};
  if (payload.kind === 'authorized-brief') return payload.brief || '';
  return payload.kind === 'counteroffer' ? payload[lang] || payload.en || '' : payload.question?.[lang] || payload.question?.en || payload.text || '';
}
function sidebar() {
  return `<aside class="neighbors"><div class="eyebrow">${t('yourNeighbors')}</div><p class="small muted">${t('switch')}</p><div class="neighbor-list">${state.participants.map((p, i) => `<button type="button" class="neighbor ${p.id === selected ? 'selected' : ''}" data-person="${p.id}" ${disabled(busy || recording)}><span class="shop-icon shop-${p.kind}">${icon(p.kind)}</span><span class="neighbor-copy"><strong>${esc(p.name)}</strong><span>${esc(p.owner)} <span class="language-tag">${p.language === 'en' ? 'EN' : '繁'}</span></span><small>${esc(p.role[lang])}</small><span class="brief-status ${p.shared ? 'is-ready' : ''}"><i></i>${p.shared ? t('shared') : t('noBrief')}</span></span><span class="neighbor-index">0${i + 1}</span></button>`).join('')}</div><div class="sidebar-note">${icon('leaf')}<p>${t('fictional')}</p></div><div class="little-map" aria-hidden="true"><div class="map-lane"></div><div class="map-block a"></div><div class="map-block b"></div><div class="map-block c"></div><span class="pin a">01</span><span class="pin b">02</span><span class="pin c">03</span><span class="map-label">GRANT AVENUE</span></div></aside>`;
}
function modes() {
  return `<div class="mode-row"><label><span class="sr-only">${t('aiMode')}</span><select id="mode" ${disabled(busy || recording)}><option value="rehearsal" ${mode === 'rehearsal' ? 'selected' : ''}>${t('rehearsal')}</option><option value="live" ${mode === 'live' ? 'selected' : ''}>${t('live')}</option></select></label>${badge(mode === 'live' ? t('live') : t('rehearsal'), mode === 'live' ? 'olive' : 'amber')}<span class="small muted">${mode === 'live' ? state.services.model : t('aiHelp')}</span></div>`;
}
function steps() {
  const step = state.proposal ? 4 : state.self.shared ? 3 : state.self.draft ? 2 : 1;
  return `<ol class="steps">${['step1', 'step2', 'step3', 'step4'].map((key, i) => `<li class="${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}"><span>${i + 1 < step ? '✓' : i + 1}</span>${t(key)}</li>`).join('')}</ol>`;
}
function advocateView() {
  const draft = state.self.draft;
  const input = inputCache[selected] ?? draft?.original ?? '';
  const understanding = draft?.understanding;
  const cached = briefCache[selected];
  const brief = cached && cached.draftId === draft?.id ? cached.text : understanding?.shareSuggestion || '';
  const ready = state.participants.filter(p => p.shared).length;
  return `<section class="work-card">${steps()}<div class="work-body"><div class="identity-line"><span class="mini-shop shop-${self().kind}">${icon(self().kind)}</span><div><span class="small muted">${t('talking')}</span><strong>${esc(self().name)} <span class="muted">/ ${esc(self().owner)}</span></strong></div>${badge(t('private'), 'subtle')}</div>${modes()}<h2>${t('speak')}</h2><p class="muted description">${t('speakHelp')}</p><label class="sr-only" for="concern">${t('speak')}</label><textarea id="concern" rows="5" maxlength="4000" placeholder="${t('placeholder')}" ${disabled(busy || recording)}>${esc(input)}</textarea><div class="input-tools">${action('seed', t('seed'), 'text-button')}${action('record', `${icon('mic')}${recording ? t('stop') : t('record')}`, recording ? 'record-button recording' : 'record-button', state.services.openai !== 'configured' && !recording)}</div><p class="tiny muted">${state.services.openai === 'configured' ? t('voiceHelp') : t('voiceUnavailable')}</p><div class="form-bottom"><span class="tiny muted">${icon('lock')}${t('private')}</span>${action('understand', `${busy && !stage ? t('working') : t('understand')}${icon('arrow')}`, 'primary', recording)}</div>${understanding ? `<div class="understanding"><div class="section-heading"><span class="agent-orb">✳</span><h3>${t('checkUnderstanding')}</h3>${badge(draft.mode === 'live' ? t('live') : t('rehearsal'), 'subtle')}</div><p class="muted small">${t('understoodHelp')}</p><blockquote>${esc(understanding.summary)}</blockquote><div class="understanding-detail"><strong>${t('goal')}</strong><p>${esc(understanding.goal)}</p>${understanding.constraints.length ? `<strong>${t('constraints')}</strong><ul>${understanding.constraints.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}<strong>${t('question')}</strong><p>${esc(understanding.question)}</p></div><div class="permission-panel"><span class="overline">${icon('lock')}${t('step2')}</span><h3>${t('permission')}</h3><label for="brief">${t('brief')}</label><textarea id="brief" rows="4" maxlength="3000" ${disabled(busy)}>${esc(brief)}</textarea><label class="check-label"><input id="share-consent" type="checkbox" ${disabled(busy)}><span>${t('consent')}</span></label><div class="permission-bottom"><p class="tiny muted">${t('authorizedHelp')}</p>${action('share', `${t('authorize')}${icon('arrow')}`, 'primary')}</div></div></div>` : ''}${state.self.shared ? `<div class="shared-confirm">${icon('check')}<div><strong>${t('shared')}</strong><p>${esc(state.self.shared.text)}</p></div>${ready < 3 ? action('next', `${t('next')}${icon('arrow')}`, 'secondary') : ''}</div>` : ''}${(state.workspace ? Boolean(state.self.shared) : ready === 3) ? negotiatePanel() : ''}</div></section>`;
}
function negotiatePanel() {
  return `<div class="negotiate-panel"><span class="eyebrow">03 / ${t('step3')}</span><h3>${t('allReady')}</h3><p>${t('allReadyHelp')}</p><label class="transport-label"><span class="sr-only">${t('messageTransport')}</span><select id="transport" ${disabled(busy)}><option value="relaycast" ${transport === 'relaycast' ? 'selected' : ''}>${t('relay')}</option><option value="rehearsal" ${transport === 'rehearsal' ? 'selected' : ''}>${t('simulatedTransport')}</option></select></label><p class="tiny muted">${t('transportHelp')}</p>${action('negotiate', `${busy && stage ? t(stage) : state.proposal ? t('renegotiate') : t('negotiate')}${icon('arrow')}`, 'primary wide')}</div>`;
}
function proposalView() {
  const p = state.proposal;
  if (!p) return `<section class="work-card"><div class="empty-main">${icon('leaf')}<h2>${t('emptyTitle')}</h2><p>${t('emptyHelp')}</p>${action('back', `${t('advocate')}${icon('arrow')}`, 'primary')}</div></section>`;
  const c = p.content[lang];
  const decision = state.approvals.find(a => a.participant === (state.workspace?.visitorId || selected)) || { status: 'pending' };
  return `<section class="work-card proposal-sheet"><div class="sheet-heading"><span class="eyebrow">${t('current')} / V${p.version}</span><div>${badge(p.mode === 'live' ? t('live') : t('rehearsal'), 'amber')}${badge(p.transport === 'relaycast' ? 'Agent Relay' : t('simulated'), p.transport === 'relaycast' ? 'olive' : '')}</div></div><h2>${esc(c.title)}</h2><p class="small muted">${t('demoOnly')}</p>${state.proposalStale ? `<div class="warning">${t('stale')}</div>` : ''}${p.translationPending ? `<div class="warning">${t('translationPending')}</div>` : ''}<div class="proposal-section"><h3>${t('terms')}</h3><ol class="term-list">${c.terms.map((term, i) => `<li><span>0${i + 1}</span><p>${esc(term)}</p></li>`).join('')}</ol></div><div class="tradeoff-grid"><section><h3>${t('tradeoffs')}</h3><ul>${c.tradeoffs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section><section><h3>${t('unresolved')}</h3><ul>${c.unresolved.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section></div><div class="cited-context"><span>${t('evidenceUsed')}</span>${c.evidenceIds.map(id => { const e = state.evidence.find(e => e.id === id); return e ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title[lang])} ↗</a>` : ''; }).join('')}</div><div class="decision-panel"><span class="eyebrow">04 / ${t('talking')} ${esc(self().name)}</span><h3>${t('approvalTitle')}</h3><label class="reviewer-switch"><span>${t('reviewingAs')}</span><select id="decision-person" ${disabled(busy)}>${state.participants.map(person => `<option value="${person.id}" ${person.id === selected ? 'selected' : ''}>${esc(person.name)} / ${esc(person.owner)}</option>`).join('')}</select></label><label class="check-label"><input id="decision-reviewed" type="checkbox" ${disabled(busy || state.proposalStale)}><span>${t('reviewBox')}</span></label><label for="decision-note" class="sr-only">${t('note')}</label><textarea id="decision-note" rows="2" maxlength="2000" placeholder="${t('note')}" ${disabled(busy)}></textarea><div class="decision-buttons">${action('approve', `${icon('check')}${t('approve')}`, 'primary decision-action', true)}${action('reject', t('reject'), 'secondary decision-action', true)}${action('request', t('request'), 'text-button decision-action', true)}</div>${decision.status !== 'pending' ? `<p class="decision-status">${badge(t(decision.status), decision.status === 'approved' ? 'olive' : 'amber')} ${esc(decision.note)}</p>` : ''}</div><details class="manual-edit"><summary>${t('manualEdit')}</summary><p class="small muted">${t('manualHelp')}</p><label class="sr-only" for="revision-note">${t('manualEdit')}</label><textarea id="revision-note" maxlength="2000" rows="3" placeholder="${t('editPlaceholder')}"></textarea>${action('revise-proposal', t('newVersion'), 'secondary', state.proposalStale)}</details><div class="proposal-bottom"><a class="button secondary" href="/api/export">${t('export')} ↓</a></div>${negotiatePanel()}</section>`;
}
function evidenceView() {
  return `<section class="work-card evidence-view"><span class="eyebrow">${t('evidence')}</span><h2>${t('evidenceTitle')}</h2><p class="muted">${t('evidenceIntro')}</p>${state.evidence.map((e, i) => `<article class="evidence-item"><div>${badge(t('reported'), 'subtle')}<span class="evidence-number">0${i + 1}</span></div><h3>${esc(e.title[lang])}</h3><p>${esc(e.text[lang])}</p><span class="tiny muted">${t('sourceMeta')}</span><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${t('source')} ↗</a></article>`).join('')}<div class="invented"><h3>${t('demoConstraints')}</h3><p>${t('invented')}</p></div><p class="small muted">${t('evidenceLimit')}</p></section>`;
}
function sharedAside() {
  const ready = state.participants.filter(p => p.shared).length;
  const p = state.proposal;
  const approvals = state.approvals.filter(a => a.status === 'approved').length;
  return `<aside class="shared-aside"><section class="shared-card"><div class="eyebrow">${t('sharedSpace')}<span class="save-dot" title="${t('localSave')}"></span></div>${p ? `<div class="version-line"><span>V${p.version}</span>${badge(p.mode === 'live' ? t('live') : t('rehearsal'), 'subtle')}</div><h3>${esc(p.content[lang].title)}</h3><div class="approval-count"><strong>${approvals}<span>/3</span></strong><p>${state.allApproved ? t('allApproved') : t('noConsensus')}</p></div><div class="approval-bar">${state.approvals.map(a => `<span class="${a.status === 'approved' ? 'filled' : ''}"></span>`).join('')}</div><div class="approval-list">${state.participants.map(person => `<div><span>${esc(person.name)}</span>${badge(t(statusFor(person.id)), statusFor(person.id) === 'approved' ? 'olive' : 'subtle')}</div>`).join('')}</div>${state.proposalStale ? `<p class="tiny warning">${t('stale')}</p>` : ''}${action('proposal', `${t('proposal')}${icon('arrow')}`, 'secondary wide')}` : `<div class="empty-illustration" aria-hidden="true"><span>${icon('tea')}</span><span>${icon('garage')}</span><span>${icon('craft')}</span><div></div></div><h3>${t('emptyTitle')}</h3><p class="small muted">${t('emptyHelp')}</p><div class="brief-progress"><strong>${ready}/3</strong><span>${t('briefsReady')}</span></div><div class="approval-bar">${state.participants.map(person => `<span class="${person.shared ? 'filled' : ''}"></span>`).join('')}</div>`}<div class="human-rule">${icon('leaf')}<span>${t('noApproval')}</span></div></section><section class="exchange-card"><div class="eyebrow">${t('exchangeTitle')}</div><p class="tiny muted">${t('exchangeHelp')}</p><div class="exchange-log">${state.exchanges.length ? state.exchanges.slice(-4).map(e => `<article class="exchange-item"><span class="exchange-route">${esc(state.participants.find(p => p.id === e.from)?.name)} <span>→</span> ${esc(state.participants.find(p => p.id === e.to)?.name)}</span><p>${esc(exchangeText(e))}</p><span class="receipt ${e.verified ? 'is-ready' : ''}">${e.verified ? '✓' : '○'} ${e.verified ? t('verified') : t('simulated')} <code>${esc(e.id.slice(-7))}</code></span></article>`).join('') : `<p class="no-exchange">${t('noExchange')}</p>`}</div>${busy && stage ? `<div class="live-progress"><span class="spinner"></span>${t(stage)}</div>` : ''}</section></aside>`;
}
function connectionsDialog() {
  if (!showConnections) return '';
  const s = state.services;
  const connections = [
    ['OpenAI', s.openaiVerified ? t('keyVerified') : s.openai === 'configured' ? t('keyConfigured') : t('keyMissing'), s.openai === 'configured'],
    ['Agent Relay / Relaycast', s.relay === 'verified' ? t('relayVerified') : t('relayUnverified'), s.relay === 'verified'],
    ['Proposal state', s.persistence === 'terse-runtime' ? 'Terse actor runtime' : t('localDb'), true],
    ['Terse Cloud', s.persistence === 'terse-runtime' ? 'Terse actor runtime' : s.terse === 'not-connected' ? t('notConnected') : t('configuredOnly'), false],
    ['Supabase', s.supabase === 'verified' || s.agendas?.vectorReady ? (lang === 'zh-Hant' ? '已驗證向量檢索' : 'Vector retrieval verified') : s.supabase === 'not-connected' ? t('notConnected') : t('configuredOnly'), s.supabase === 'verified' || Boolean(s.agendas?.vectorReady)],
  ];
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="connection-title"><div class="section-heading"><h2 id="connection-title">${t('connectionTitle')}</h2>${action('close-connections', '×', 'close-button', false, `aria-label="${t('close')}"`)}</div><p>${t('setup')}</p><div class="connection-list">${connections.map(([name, desc, active]) => `<div><strong>${esc(name)}</strong><span class="${active ? 'is-ready' : 'muted'}">${esc(desc)}</span></div>`).join('')}</div><p class="small muted">${t('terseHelp')}</p>${action('refresh', t('refresh'), 'primary')} <a class="button secondary" href="/service-flow.html" target="_blank" rel="noopener">${lang === 'zh-Hant' ? '即時 API 流程' : 'Live API flow'} ↗</a><details><summary>${t('newSession')}</summary><p class="small muted">${t('archiveHelp')}</p>${action('restart', t('newSession'), 'secondary')}</details></section></div>`;
}
function render() {
  if (!state) return;
  features.captureFields();
  document.documentElement.lang = lang;
  app.innerHTML = `<div class="demo-ribbon"><span>${t('demo')}</span><span>${icon('lock')}${t('localSave')}</span></div><header class="header"><a class="brand" href="/" aria-label="Common Ground"><img src="/favicon.svg" width="37" height="37" alt=""><span>common<span class="brand-serif">ground</span><small>${t('tagline')}</small></span></a><nav aria-label="Workspace">${['advocate', 'proposal', 'evidence'].map(name => `<button data-nav="${name}" class="nav-item ${view === name ? 'active' : ''}" ${disabled(busy || recording)}>${t(name)}${name === 'proposal' && state.proposal ? '<i></i>' : ''}</button>`).join('')}</nav><div class="header-tools"><label class="sr-only" for="language">${t('language')}</label><select id="language" ${disabled(busy || recording)}><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="zh-Hant" ${lang === 'zh-Hant' ? 'selected' : ''}>繁體中文</option></select>${action('connections', icon('link'), 'connection-button', recording, `aria-label="${t('connections')}" title="${t('connections')}"`)}</div></header><main><section class="hero"><div><div class="eyebrow"><span class="orange-line"></span>${t('eyebrow')}</div><h1>${t('headline')}<br><em>${t('headline2')}</em></h1><p>${t('intro')}</p></div><div class="hero-right"><div class="community-stamp">${icon('leaf')}<span>COMMON<br>GROUND</span><small>EST. TOGETHER</small></div><div class="hero-stats"><span><strong>03</strong>${t('neighbors')}</span><span><strong>02</strong>${t('languages')}</span><span><strong>01</strong>${t('sharedDraft')}</span></div></div></section><div class="workspace-grid">${sidebar()}<div class="main-workspace" aria-busy="${busy}">${busy ? `<div class="operation-status" role="status"><span class="spinner"></span><span>${stage ? t(stage) : t('working')}</span></div>` : ''}${view === 'advocate' ? advocateView() : view === 'proposal' ? proposalView() : evidenceView()}</div>${sharedAside()}</div><div class="scope-note">${icon('leaf')}${t('scope')}</div></main><footer><span>${t('footer')}</span><span>${t('footerRight')}</span></footer>${connectionsDialog()}`;
  features.mount();
  const noteKey = `${state.id}:${state.proposal?.version}:${selected}`;
  const decisionNote = document.querySelector('#decision-note'); if (decisionNote && Object.hasOwn(decisionNotes, noteKey)) decisionNote.value = decisionNotes[noteKey];
  const revisionNote = document.querySelector('#revision-note'); if (revisionNote && Object.hasOwn(revisionNotes, noteKey)) revisionNote.value = revisionNotes[noteKey];
}

app.addEventListener('change', async event => {
  if (event.target.id === 'language') { capture(); lang = event.target.value; localStorage.setItem('cg-language', lang); render(); }
  if (event.target.id === 'mode') { capture(); mode = event.target.value; render(); if (mode === 'live' && state.services.openai !== 'configured') toast(t('liveMissing'), true); }
  if (['transport', 'share-transport'].includes(event.target.id)) transport = event.target.value;
  if (event.target.id === 'decision-person') { selected = event.target.value; localStorage.setItem('cg-participant', selected); try { await refresh(); render(); document.querySelector('.decision-panel')?.scrollIntoView({block:'center'}); } catch (error) { toast(error.message, true); } }
  if (event.target.id === 'decision-reviewed') document.querySelectorAll('.decision-action').forEach(button => { button.disabled = !event.target.checked || busy || state.proposalStale || (button.dataset.action === 'approve' && state.proposal.translationPending); });
});
app.addEventListener('click', async event => {
  const personButton = event.target.closest('[data-person]');
  if (personButton && !busy && !recording) { capture(); selected = personButton.dataset.person; localStorage.setItem('cg-participant', selected); try { await refresh(); render(); } catch (e) { toast(e.message, true); } return; }
  const nav = event.target.closest('[data-nav]');
  if (nav && !busy && !recording) { capture(); view = nav.dataset.nav; render(); if (view === 'evidence') { await features.loadAgendaExtras(); render(); } return; }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  if (await features.click(button)) return;
  const a = button.dataset.action;
  if (a === 'connections') { capture(); showConnections = true; render(); document.querySelector('.close-button')?.focus(); }
  if (a === 'close-connections') { showConnections = false; render(); }
  if (a === 'refresh') { try { await refresh(); render(); toast(t('saved')); } catch (e) { toast(e.message, true); } }
  if (a === 'seed') { inputCache[selected] = self().seed[lang]; dirtyConcerns.add(selected); render(); document.querySelector('#concern').focus(); }
  if (a === 'understand') {
    const concern = document.querySelector('#concern').value.trim();
    if (!concern) return document.querySelector('#concern').focus();
    const ok = await mutate('/api/understand', { text: concern, language: lang, mode });
    if (ok) { dirtyConcerns.delete(selected); dirtyBriefs.delete(selected); delete briefCache[selected]; render(); document.querySelector('.understanding')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  if (a === 'share') {
    if (!document.querySelector('#share-consent').checked) return toast(t('consentNeeded'), true);
    if (await mutate('/api/share', { brief: document.querySelector('#brief').value, consent: true, draftId: state.self.draft.id, transport }, t('reviewed'))) dirtyBriefs.delete(selected);
  }
  if (a === 'next') { capture(); selected = state.participants.find(p => !p.shared)?.id || 'tea'; localStorage.setItem('cg-participant', selected); await refresh(); render(); document.querySelector('.work-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (a === 'negotiate') {
    stage = 'asking';
    if (await mutate('/api/negotiate', { mode, transport })) { view = 'proposal'; render(); document.querySelector('.work-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  if (a === 'proposal' || a === 'back') { capture(); view = a === 'proposal' ? 'proposal' : 'advocate'; render(); }
  if (['approve', 'reject', 'request'].includes(a)) {
    if (!document.querySelector('#decision-reviewed')?.checked) return;
    await mutate('/api/decision', { version: state.proposal.version, status: { approve: 'approved', reject: 'rejected', request: 'revise' }[a], reviewed: true, note: document.querySelector('#decision-note').value }, t('decisionSaved'));
  }
  if (a === 'revise-proposal') { const note = document.querySelector('#revision-note').value.trim(); if (!note) return document.querySelector('#revision-note').focus(); await mutate('/api/revise', { version: state.proposal.version, note }, t('saved')); }
  if (a === 'restart') { inputCache = {}; briefCache = {}; dirtyConcerns.clear(); dirtyBriefs.clear(); await mutate('/api/restart', {}, t('saved')); view = 'advocate'; showConnections = false; render(); }
  if (a === 'record') await record();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && showConnections && !busy) { showConnections = false; render(); } });

async function record() {
  if (recording && recorder) { recorder.stop(); return; }
  capture();
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast(t('micError'), true);
  try {
    recorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(recorderStream, mime ? { mimeType: mime } : {});
    const chunks = []; const recordingLang = lang; const recordingPerson = selected;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      clearTimeout(record.autoStop); recording = false; recorderStream.getTracks().forEach(track => track.stop()); busy = true; render(); toast(t('transcribing'));
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const response = await fetch(`/api/transcribe?language=${recordingLang}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        inputCache[recordingPerson] = [inputCache[recordingPerson] || '', data.text].filter(Boolean).join('\n'); dirtyConcerns.add(recordingPerson); toast(t('saved'));
      } catch (e) { toast(e.message, true); }
      finally { busy = false; recorder = null; render(); if (privateRefreshPending) queueMicrotask(refreshPrivateUpdates); }
    };
    recorder.start(); recording = true; render(); toast(t('recording'));
    record.autoStop = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, 60000);
  } catch { recorderStream?.getTracks().forEach(track => track.stop()); toast(t('micError'), true); }
}

const features = createFeatures({ getState: () => state, getLanguage: () => lang, getSelected: () => selected, getTransport: () => transport, setSelected: value => { selected = value; localStorage.setItem('cg-participant', value); }, setState: value => { state = value; }, setView: value => { view = value; }, resetInputs: () => { inputCache = {}; briefCache = {}; dirtyConcerns.clear(); dirtyBriefs.clear(); }, api, refresh, render, capture, toast, esc, action });
app.addEventListener('submit', event => { features.submit(event); });
app.addEventListener('input', event => { features.captureFields(event); if (event.target.id === 'concern') dirtyConcerns.add(selected); if (event.target.id === 'brief') dirtyBriefs.add(selected); });
app.addEventListener('change', event => features.captureFields(event));

try {
  await refresh(); mode = state.services.openai === 'configured' ? 'live' : 'rehearsal'; render();
  if (view === 'evidence') { await features.loadAgendaExtras(); render(); }
  const events = new EventSource('/api/events');
  events.onmessage = event => {
    const data = JSON.parse(event.data);
    const ownParticipantChanged = data.participantRevision != null && data.participantRevision !== state.participantRevision && (!data.visitorId || data.visitorId === state.workspace?.visitorId);
    if (ownParticipantChanged) {
      privateRefreshPending = true;
      void refreshPrivateUpdates();
    }
    if (!ownParticipantChanged && !busy && data.revision && data.revision !== state.revision) features.noteChange(data.revision);
    if (busy && ['asking', 'replying', 'drafting', 'checking'].includes(data.stage)) {
      stage = data.stage;
      // Keep in-progress form content intact while updating only the progress line.
      const progress = document.querySelector('.live-progress'); if (progress) progress.innerHTML = `<span class="spinner"></span>${t(stage)}`;
      const button = document.querySelector('[data-action="negotiate"]'); if (button) button.textContent = t(stage);
      const operation = document.querySelector('.operation-status > span:last-child'); if (operation) operation.textContent = t(stage);
    }
  };
} catch (error) { app.innerHTML = `<div class="loading"><strong>Common Ground</strong><p>${esc(error.message)}</p><p>Start the local server with <code>npm start</code>, then reload.</p></div>`; }
