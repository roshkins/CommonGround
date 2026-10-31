// Progressive workspace, phone and agenda controls. The server owns all permissions.
export function createFeatures(context) {
  const { getState, getLanguage, getSelected, api, refresh, render, capture, toast, esc, action } = context;
  const copy = (en, zh) => getLanguage() === 'zh-Hant' ? zh : en;
  const opened = new Set();
  const dismissed = new Set();
  let joining = false, pairing = null, agendaData = null, watch = null, alerts = null, featureError = '', loading = false;
  let query = '', period = 'all', pendingRevision = null;
  const formFields = {};
  const dirtyFields = new Set();
  let spokenLanguage = localStorage.getItem('cg-phone-language') || 'auto';
  if (!['en', 'yue', 'sq', 'auto'].includes(spokenLanguage)) spokenLanguage = 'auto';
  const words = value => typeof value === 'object' && value ? value[getLanguage()] || value.en || '' : value || '';
  const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const shortDate = value => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(getLanguage() === 'zh-Hant' ? 'zh-TW' : 'en-US', { dateStyle: 'medium', timeZone: 'America/Los_Angeles' }).format(date);
  };
  const statusText = value => typeof value === 'string' ? value : value?.message || value?.label || value?.mode || '';
  const state = () => getState();
  const shared = () => state().workspace?.mode === 'shared';
  function workspaceBar() {
    const w = state().workspace;
    const name = w?.displayName || copy('You', '你');
    return `<section class="workspace-bar" aria-label="${copy('Workspace', '工作區')}"><div><span class="overline">${copy('YOUR NEIGHBORHOOD SPACE', '你的鄰里空間')}</span><strong>${shared() ? copy('Shared neighborhood', '共同鄰里') : copy('Your private demo', '你的私人示範')}</strong><span>${shared() ? `${esc(name)} · ${copy('Only authorized briefs become shared', '只有已授權的摘要才會分享')}` : copy('Try the whole story in your own workspace.', '在自己的工作區體驗完整流程。')}</span></div><div class="workspace-actions">${shared() ? action('private-space', copy('Return to private demo', '返回私人示範'), 'secondary') : action('open-join', copy('Join the shared neighborhood', '加入共同鄰里'), 'secondary')}${action('agenda-open', `${copy('Agenda watch', '議程追蹤')}${alerts?.alerts?.some(a => !a.readAt && !a.read) ? ' •' : ''}`, 'text-button')}</div></section><p class="judge-hint">${copy('The journey', '體驗流程')} <span>${copy('Talk → Authorize → Explore → Review', '表達 → 授權 → 探索 → 審閱')}</span></p>${pendingRevision ? `<div class="workspace-change" role="status">${copy('The neighborhood changed. Your unsent text is safe.', '鄰里內容有更新。你未送出的文字仍保留。')} ${action('sync-workspace', copy('Review update', '查看更新'), 'secondary')}</div>` : ''}`;
  }
  function joinDialog() {
    if (!joining) return '';
    return `<div class="modal-backdrop"><section class="modal join-modal" role="dialog" aria-modal="true" aria-labelledby="join-title"><div class="section-heading"><h2 id="join-title">${copy('A conversation already in motion.', '一場正在進行的對話。')}</h2>${action('close-join', '×', 'close-button', false, `aria-label="${copy('Close', '關閉')}"`)}</div><p>${copy('Explore the same fictional street-market negotiation as earlier visitors. Their authorized contributions and versioned decisions remain in the story.', '與先前訪客一起體驗同一個虛構街市協商。已授權的意見及各版本的決定會保留。')}</p><div class="join-disclosure">${copy('You join as an observer. Your concern and unshared draft remain private. Reviewing and authorizing a brief makes you a contributor. Votes belong to individual demo visitors, not real businesses.', '你會先以觀察者身份加入。你的原始意見及未分享草稿仍屬私人。審閱並授權摘要後，你才成為參與者。投票屬於各位示範訪客，不代表真實商戶。')}</div><label class="field-label" for="visitor-name">${copy('What should we call you?', '我們該如何稱呼你？')}</label><input id="visitor-name" maxlength="50" autocomplete="nickname" placeholder="${copy('A first name or nickname', '名字或暱稱')}"><label class="field-label" for="join-perspective">${copy('Choose a fictional perspective', '選擇虛構角色')}</label><select id="join-perspective">${state().participants.map(p => `<option value="${esc(p.id)}" ${p.id === getSelected() ? 'selected' : ''}>${esc(p.name)} · ${esc(words(p.role))}</option>`).join('')}</select><label class="check-label"><input type="checkbox" id="join-consent"><span>${copy('I understand how this shared demo works.', '我了解這個共同示範的運作方式。')}</span></label>${action('confirm-join', copy('Join as an observer', '以觀察者身份加入'), 'primary wide')}<p class="tiny muted">${copy('No real owner identity is verified, and no proposal is submitted to the city.', '此示範不驗證真實店主身份，也不會向市府提交方案。')}</p></section></div>`;
  }
  function phoneCard() {
    const s = state().services || {};
    const phone = pairing?.phoneNumber || state().phone?.phoneNumber || s.phoneNumber || s.phone?.phoneNumber || '';
    const digits = phone.replace(/\D/g, '');
    const displayedPhone = /^1\d{10}$/.test(digits) ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}` : phone;
    const callable = s.phone?.configured !== false && /^\+?[\d ()-]{7,22}$/.test(phone);
    const expired = pairing?.expiresAt && Date.parse(pairing.expiresAt) < Date.now();
    return `<section class="phone-card"><div class="phone-symbol" aria-hidden="true">☎</div><div class="phone-copy"><span class="overline">${copy('A SPARE MOMENT IS ENOUGH', '有空的片刻，已經足夠')}</span><h3>${copy('Call your advocate.', '致電你的倡議助手。')}</h3><p>${copy('Tell us what matters. You decide what may be shared.', '說出你關心的事。由你決定哪些內容可以分享。')}</p><p class="phone-language-hint">${copy('Start speaking in your preferred language; ask to switch anytime.', '開始時可用你偏好的語言表達，並可隨時要求切換。')}</p>${callable ? `<a class="phone-number" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">${esc(displayedPhone)}</a>` : `<p class="phone-unavailable">${copy('Phone line awaiting connection. Browser voice and text remain available.', '電話線路尚待連接。仍可使用瀏覽器語音及文字。')}</p>`}${pairing && !expired ? `<div class="pair-code"><span>${copy('Enter this code on the phone keypad', '請在電話鍵盤輸入配對碼')}</span><strong>${esc(pairing.code)}</strong><small>${copy('Expires', '有效至')} ${esc(new Date(pairing.expiresAt).toLocaleTimeString(getLanguage(), { hour: 'numeric', minute: '2-digit' }))}</small></div>` : ''}<div class="phone-pair-controls"><label for="phone-spoken-language"><span>${copy('Phone language', '電話語言')}</span><select id="phone-spoken-language"><option value="en" ${spokenLanguage === 'en' ? 'selected' : ''}>English</option><option value="yue" ${spokenLanguage === 'yue' ? 'selected' : ''}>粵語</option><option value="sq" ${spokenLanguage === 'sq' ? 'selected' : ''}>Shqip</option><option value="auto" ${spokenLanguage === 'auto' ? 'selected' : ''}>🌐 Auto</option></select></label>${action('phone-pair', pairing && !expired ? copy('Get a new pairing code', '取得新配對碼') : copy('Get a pairing code', '取得配對碼'), 'secondary')}</div><p class="phone-keypad-help">${copy('If the phone asks for a language: 1 English · 2 粵語 · 3 Shqip · 0 Auto', '如果電話詢問語言：1 English · 2 粵語 · 3 Shqip · 0 Auto')}</p>${pairing?.message ? `<p class="tiny muted">${esc(pairing.message)}</p>` : ''}</div></section>`;
  }
  function shareOffer() {
    const draft = state().self?.draft;
    const permission = document.querySelector('.permission-panel');
    if (!permission) return;
    if (!draft?.understanding?.shareSuggestion || draft.understanding.allowed === false) { permission.hidden = true; return; }
    const key = draft.id;
    permission.hidden = !opened.has(key);
    const offer = document.createElement('section'); offer.className = 'share-offer';
    offer.innerHTML = `<span class="agent-orb" aria-hidden="true">✳</span><div><strong>${dismissed.has(key) ? copy('Your concern stays private.', '你的意見仍屬私人。') : copy('This could help the shared proposal.', '這個意見可幫助共同方案。')}</strong><p>${dismissed.has(key) ? copy('You can review a shareable brief whenever you are ready.', '準備好時，你隨時可以審閱可分享的摘要。') : copy('Would you like to review a brief for the other advocates? You decide the exact words that leave this conversation.', '你想審閱一份給其他助手的摘要嗎？由你決定哪些確切文字可以離開這段對話。')}</p><div>${action('review-share', copy('Review shareable brief', '審閱可分享摘要'), 'secondary')}${!dismissed.has(key) ? action('keep-private', copy('Keep private', '保持私人'), 'text-button') : ''}</div></div>`;
    permission.before(offer);
    if (shared()) {
      const note = document.createElement('p'); note.className = 'permission-destination';
      note.textContent = copy('Destination: this shared neighborhood. Authorizing makes this reviewed brief visible to other visitors and advocates.', '分享對象：這個共同鄰里。授權後，其他訪客及助手將可查看這份已審閱摘要。'); permission.prepend(note);
    }
    permission.querySelector('.permission-bottom')?.insertAdjacentHTML('beforebegin', `<label class="field-label" for="share-transport">${copy('How the authorized brief travels', '已授權摘要的傳送方式')}</label><select id="share-transport" class="share-transport"><option value="relaycast" ${context.getTransport() === 'relaycast' ? 'selected' : ''}>${copy('Actual Agent Relay', '實際 Agent Relay')}</option><option value="rehearsal" ${context.getTransport() === 'rehearsal' ? 'selected' : ''}>${copy('Simulated exchange · rehearsal only', '模擬交流 · 僅供演練')}</option></select><p class="tiny muted">${copy('Only the reviewed brief is sent. Simulated exchange is clearly labeled and does not use Relay.', '只會傳送已審閱摘要。模擬交流會清楚標示，並不使用 Relay。')}</p>`);
  }
  function agendaCards() {
    if (!agendaData) return `<p class="empty-agenda">${copy('Search published agendas to find the public decisions connected to your concern.', '搜尋已發佈議程，找出與你的意見相關的公共決策。')}</p>`;
    const results = agendaData.results || [];
    const source = agendaData.status || {};
    const awaiting = [...(source.upcomingAwaiting || [])].sort((a, b) => Date.parse(a.meetingDate) - Date.parse(b.meetingDate));
    const sourceStatus = typeof source === 'object' ? `${source.source || ''}${source.lastSuccessfulAt ? ` · ${copy('Last checked', '上次檢查')} ${shortDate(source.lastSuccessfulAt)}` : ''}${agendaData.mode ? ` · ${agendaData.mode === 'supabase-vector' ? copy('Vector retrieval', '向量檢索') : copy('Cited keyword retrieval', '附來源關鍵字檢索')}` : ''}` : statusText(source);
    const cards = results.map(item => {
      const url = safeUrl(item.url || item.sourceUrl || item.source?.url);
      const meeting = item.meetingDate || item.meetingAt || item.eventDate;
      const upcoming = item.period === 'upcoming' || (meeting && new Date(meeting).getTime() >= Date.now());
      const passage = String(words(item.excerpt || item.snippet || item.text || item.summary));
      const chars = Array.from(passage);
      const shortened = chars.length > 280;
      const preview = shortened ? `${chars.slice(0, 280).join('').trimEnd()}…` : passage;
      return `<article class="agenda-result"><div class="agenda-card-top">${badge(copy(upcoming ? 'Upcoming meeting' : 'Past meeting', upcoming ? '即將舉行' : '過往會議'), upcoming ? 'olive' : 'subtle')}<span>${esc(item.agency || item.jurisdiction || item.body || '')}</span></div><h3>${esc(words(item.title) || copy('Published agenda', '已發佈議程'))}</h3>${meeting ? `<p class="meeting-date">${copy('Meeting', '會議')} · ${esc(shortDate(meeting))}</p>` : ''}<p class="agenda-excerpt">${esc(preview)}</p>${shortened ? `<details class="cited-passage"><summary>${copy('Read cited passage', '閱讀引用原文')}</summary><p>${esc(passage)}</p></details>` : ''}${item.relevance || item.whyRelevant ? `<div class="relevance"><strong>${copy('Why this may matter', '為何可能相關')}</strong> ${esc(words(item.relevance || item.whyRelevant))}</div>` : ''}<div class="agenda-meta">${item.publishedAt || item.publishedDate ? `<span>${copy('Published', '發佈')} ${esc(shortDate(item.publishedAt || item.publishedDate))}</span>` : ''}${item.itemNumber || item.item ? `<span>${copy('Item', '項目')} ${esc(item.itemNumber || item.item)}</span>` : ''}${item.page ? `<span>${copy('Page', '頁')} ${esc(item.page)}</span>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${copy('Read original source', '閱讀原始資料')} ↗</a>` : `<span>${copy('Original source not available', '未提供原始資料')}</span>`}</div></article>`;
    });
    const shownResults = cards.length ? `${cards.slice(0, 2).join('')}${cards.length > 2 ? `<details class="more-agenda-results"><summary>${copy('More cited matches', '更多附來源結果')} (${cards.length - 2})</summary>${cards.slice(2).join('')}</details>` : ''}` : `<p class="empty-agenda">${copy('No matching published agendas found. Try a broader topic or time period.', '找不到相符的已發佈議程。請嘗試更廣泛的主題或時段。')}</p>`;
    const scheduled = awaiting.length && period !== 'past' ? `<details class="scheduled-agendas"><summary><span>${copy('Scheduled meetings awaiting agendas', '已排期、尚待議程的會議')} (${awaiting.length})</span>${awaiting[0]?.meetingDate ? `<small>${copy('Next', '下一次')} · ${esc(shortDate(awaiting[0].meetingDate))}</small>` : ''}</summary><p>${copy('These meetings are scheduled, but their agendas have not been published. No agenda content is inferred.', '這些會議已排期，但議程尚未發佈。我們不會推測議程內容。')}</p>${awaiting.map(meeting => `<article class="agenda-awaiting">${badge(copy('Agenda not yet published', '議程尚未發佈'), 'amber')}<h3>${esc(meeting.title)}</h3><p>${esc(shortDate(meeting.meetingDate))}</p>${safeUrl(meeting.url) ? `<a href="${esc(safeUrl(meeting.url))}" target="_blank" rel="noopener noreferrer">${copy('Official meeting page', '官方會議頁面')} ↗</a>` : ''}</article>`).join('')}</details>` : '';
    return `<p class="agenda-status">${esc(sourceStatus)}</p>${source.error ? `<p class="warning">${esc(source.error)}</p>` : ''}${shownResults}${scheduled}`;
  }
  function badge(label, cls) { return `<span class="badge ${cls}">${esc(label)}</span>`; }
  function agendaPanel() {
    return `<section class="agenda-panel"><span class="overline">${copy('PUBLIC DECISIONS, IN CONTEXT', '公共決策，保留背景')}</span><h2>${copy('What is on the agenda?', '議程上，有甚麼？')}</h2><p>${copy('Explore past discussion and published upcoming meetings. A source provides context, not a promise about what officials will decide.', '了解過往討論及已發佈的未來會議。資料提供背景，並不代表官員將作出甚麼決定。')}</p><form id="agenda-search" class="agenda-search"><label class="sr-only" for="agenda-query">${copy('Search agendas', '搜尋議程')}</label><input id="agenda-query" value="${esc(query)}" placeholder="${copy('Street closures, delivery access…', '封路、送貨通行……')}"><label class="sr-only" for="agenda-period">${copy('Meeting period', '會議時段')}</label><select id="agenda-period"><option value="all" ${period === 'all' ? 'selected' : ''}>${copy('All meetings', '所有會議')}</option><option value="upcoming" ${period === 'upcoming' ? 'selected' : ''}>${copy('Upcoming', '即將舉行')}</option><option value="past" ${period === 'past' ? 'selected' : ''}>${copy('Past', '過往')}</option></select><button type="submit" class="primary" ${loading ? 'disabled' : ''}>${copy(loading ? 'Searching…' : 'Search', loading ? '搜尋中……' : '搜尋')}</button></form>${featureError ? `<p class="warning" role="status">${esc(featureError)}</p>` : ''}<div class="agenda-results">${agendaCards()}</div><details class="watch-settings" ${watch?.enabled ? 'open' : ''}><summary>${copy('Keep an eye on what matters to you', '留意你關心的事')}</summary><p>${copy('Choose the topics and areas you want to watch. These preferences do not authorize sharing a concern with other advocates.', '選擇要追蹤的主題及地區。這些偏好不會授權向其他助手分享你的意見。')}</p><label class="field-label" for="watch-topics">${copy('Topics, separated by commas', '主題，以逗號分隔')}</label><input id="watch-topics" value="${esc((watch?.topics || []).join(', '))}" placeholder="${copy('Delivery access, street closures, night markets', '送貨通行、封路、夜市')}"><label class="field-label" for="watch-areas">${copy('Areas or agencies, separated by commas', '地區或機構，以逗號分隔')}</label><input id="watch-areas" value="${esc((watch?.areas || []).join(', '))}" placeholder="${copy('Chinatown, San Francisco', '唐人街、三藩市')}"><label class="check-label"><input id="watch-enabled" type="checkbox" ${watch?.enabled ? 'checked' : ''}><span>${copy('Watch newly published agendas for these topics and keep matches in my inbox.', '追蹤新發佈的相關議程，並把相符資料保留在我的收件匣。')}</span></label>${action('save-watch', copy('Save agenda watch', '儲存議程追蹤'), 'primary')}<div class="push-controls"><p>${copy('Browser notifications are optional and require your permission. Your inbox works without them.', '瀏覽器通知屬自選，需要你的許可。即使不開啟，仍可使用收件匣。')}</p>${action('enable-push', copy('Enable browser notifications', '開啟瀏覽器通知'), 'secondary')}${action('disable-push', copy('Turn off notifications', '關閉通知'), 'text-button')}${action('test-push', copy('Send a test notification', '傳送測試通知'), 'text-button')}</div></details><section class="alert-inbox"><div class="section-heading"><h3>${copy('Your agenda inbox', '你的議程收件匣')}</h3>${action('refresh-alerts', copy('Refresh', '更新'), 'text-button')}</div><p class="agenda-status">${esc(statusText(alerts?.status))}</p>${alerts?.alerts?.length ? alerts.alerts.map(alert => {
      const url = safeUrl(alert.url || alert.sourceUrl || alert.agenda?.url);
      const label = (alert.readAt || alert.read) ? copy('Read', '已讀') : alert.baseline ? copy('Existing agenda match', '現有議程相符資料') : copy('New agenda match', '新議程相符資料');
      return `<article class="alert-card ${(alert.readAt || alert.read) ? 'is-read' : ''}">${badge(label, (alert.readAt || alert.read) ? 'subtle' : 'olive')}<h4>${esc(words(alert.title || alert.agenda?.title))}</h4><p>${esc(words(alert.reason || alert.summary || alert.message))}</p>${alert.meetingDate ? `<span class="small">${esc(shortDate(alert.meetingDate))}</span>` : ''}<div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${copy('Read agenda', '閱讀議程')} ↗</a>` : ''}${!(alert.readAt || alert.read) ? action('read-alert', copy('Mark read', '標示已讀'), 'text-button', false, `data-alert-id="${esc(alert.id)}"`) : ''}</div></article>`;
    }).join('') : `<p class="empty-agenda">${copy('No new matches yet. Saved watches will place relevant published agendas here when the source checker finds them.', '尚無新相符資料。來源檢查找到相關已發佈議程時，會顯示在這裡。')}</p>`}</section></section>`;
  }
  function mount() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.insertAdjacentHTML('afterend', workspaceBar());
    const body = document.querySelector('.work-body');
    if (body) { body.insertAdjacentHTML('afterbegin', phoneCard()); shareOffer(); }
    const evidence = document.querySelector('.evidence-view');
    if (evidence) evidence.insertAdjacentHTML('afterbegin', agendaPanel());
    if (joining) document.querySelector('#app').insertAdjacentHTML('beforeend', joinDialog());
    if (state().workspace) adaptShared();
    for (const [id, value] of Object.entries(formFields)) { const field = document.getElementById(id); if (field) { if (field.type === 'checkbox') field.checked = value; else field.value = value; } }
  }
  function adaptShared() {
    document.querySelector('.sidebar-note p').textContent = copy('Three fictional business perspectives. Your private draft and your visitor vote belong to you. Scenario concerns provide context, never consent.', '三種虛構商戶角度。你的私人草稿及訪客投票只屬於你。情境意見只提供背景，不代表同意。');
    document.querySelector('[data-action="next"]')?.remove();
    const reviewSwitch = document.querySelector('.reviewer-switch');
    if (reviewSwitch) reviewSwitch.hidden = true;
    const panel = document.querySelector('.decision-panel');
    if (panel) {
      const label = panel.querySelector('.check-label span');
      if (label) label.textContent = copy('I reviewed this exact version and am recording my own demo decision.', '我已審閱這個確切版本，並記錄自己的示範決定。');
      const approve = panel.querySelector('[data-action="approve"]'); if (approve) approve.textContent = copy('Approve as myself', '以自己身份批准');
      panel.querySelector('.eyebrow').textContent = `${copy('YOUR DECISION', '你的決定')} / ${state().workspace?.displayName || copy('Demo visitor', '示範訪客')}`;
      if (!state().workspace?.isContributor) {
        panel.querySelectorAll('.decision-action, #decision-reviewed, #decision-note').forEach(input => { input.disabled = true; });
        panel.insertAdjacentHTML('afterbegin', `<p class="warning">${copy('You are observing. Authorize your own reviewed brief before recording a contributor decision.', '你正在觀察。請先授權自己審閱過的摘要，才可記錄參與者決定。')}</p>`);
      }
    }
    if (!state().workspace?.isContributor) document.querySelectorAll('[data-action="negotiate"], [data-action="revise-proposal"]').forEach(button => { button.disabled = true; });
    const sideCard = document.querySelector('.shared-card');
    if (!sideCard) return;
    document.querySelector('.shared-aside')?.insertAdjacentHTML('afterbegin', authorizedConcerns(state().contributors || []));
    const contributors = state().contributors || state().sharedContext?.contributors || [];
    const reviews = state().contributorApprovals || state().sharedContext?.approvals || contributors;
    const current = state().proposal?.version;
    const approved = reviews.filter(p => (p.status || p.decision?.status) === 'approved' && (p.version == null || p.version === current));
    sideCard.querySelector('.approval-count')?.remove();
    sideCard.querySelector('.approval-list')?.remove();
    sideCard.querySelector('.approval-bar')?.remove();
    sideCard.querySelector('.brief-progress')?.remove();
    const emptyHelp = sideCard.querySelector(':scope > .small');
    if (emptyHelp) emptyHelp.textContent = copy('Authorize your own brief, then explore how it changes the shared proposal. The other business perspectives begin as labeled fictional context.', '授權自己的摘要，再探索它如何改變共同方案。其他商戶角度最初只屬清楚標示的虛構背景。');
    const box = document.createElement('div'); box.className = 'visitor-reviews';
    box.innerHTML = `${state().proposal ? `<strong>${approved.length}<span>/${contributors.length}</span></strong><p>${copy('contributing visitors approved this version', '位參與訪客已批准此版本')}</p>` : `<strong>${contributors.length}</strong><p>${copy(contributors.length === 1 ? 'contributor · waiting for a proposal' : 'contributors · waiting for a proposal', '位參與者 · 等待方案草稿')}</p>`}${contributors.length ? `<ul>${contributors.map(p => `<li><span>${esc(p.displayName || p.name || copy('Demo visitor', '示範訪客'))}</span><span>${esc(p.status || p.decision?.status || copy('Awaiting review', '等待審閱'))}</span></li>`).join('')}</ul>` : `<p>${copy('Join by authorizing your own reviewed brief. Scenario seeds provide context, not votes.', '授權自己審閱過的摘要後即可參與。情境範例只提供背景，不代表投票。')}</p>`}`;
    sideCard.querySelector('.human-rule')?.before(box);
    const history = state().sharedContext?.history || state().sharedContext?.contributions || state().contributions || [];
    if (history.length) {
      const details = document.createElement('details'); details.className = 'contribution-history';
      details.innerHTML = `<summary>${copy('Earlier neighborhood contributions', '先前的鄰里意見')}</summary>${history.slice(-8).map(h => `<article><strong>${esc(h.displayName || h.actor?.displayName || copy('Demo visitor', '示範訪客'))}</strong><p>${esc(h.brief?.text || h.text || h.note || h.type || '')}</p></article>`).join('')}`;
      sideCard.append(details);
    }
  }
  function authorizedConcerns(contributors) {
    const inShared = shared();
    return `<section class="authorized-concerns" aria-labelledby="authorized-concerns-title"><div class="section-heading"><span class="overline">${inShared ? copy('LIVE SHARED SPACE', '即時共同空間') : copy('YOUR PRIVATE SPACE', '你的私人空間')}</span><span class="concern-count">${contributors.length}</span></div><h3 id="authorized-concerns-title">${inShared ? copy('Authorized neighborhood concerns', '已授權的鄰里意見') : copy('Your authorized concerns', '你已授權的意見')}</h3><p class="concerns-scope">${inShared ? copy('Only briefs each visitor reviewed and explicitly shared. Private calls and unshared drafts stay private.', '只顯示各訪客已審閱並明確授權分享的摘要。私人通話及未分享草稿仍屬私人。') : copy('The exact briefs you reviewed and authorized for advocates in your private demo. Your raw calls and unapproved drafts are not listed.', '只顯示你已審閱並授權給私人示範內助手的摘要原文。原始通話及未批准草稿不會列出。')}</p>${contributors.length ? contributors.map(person => {
      const brief = String(person.brief || '');
      const chars = Array.from(brief); const long = chars.length > 220;
      const business = state().participants.find(p => p.id === person.perspective);
      return `<article class="authorized-concern"><strong>${esc(person.displayName || copy('Demo visitor', '示範訪客'))}</strong>${business ? `<span class="concern-perspective">${esc(business.name)} · ${copy('fictional perspective', '虛構角度')}</span>` : ''}<p>${esc(long ? `${chars.slice(0, 220).join('').trimEnd()}…` : brief)}</p>${long ? `<details><summary>${copy('Read exact authorized brief', '閱讀已授權摘要原文')}</summary><p>${esc(brief)}</p></details>` : ''}</article>`;
    }).join('') : `<p class="concerns-empty">${inShared ? copy('No approved-for-sharing briefs yet. Join as an observer, then review and authorize your own brief to add a concern.', '尚無獲准分享的摘要。先以觀察者身份加入，再審閱並授權自己的摘要，即可加入意見。') : copy('No authorized concerns yet. Review the exact brief on screen or complete the phone review and confirmation first. Unapproved speech stays private.', '尚無已授權意見。請先在畫面審閱摘要原文，或完成電話審閱及確認。未批准的語音內容仍屬私人。')}</p>`}<span class="concerns-footnote">${inShared ? copy('Sharing a concern is not approving a proposal.', '分享意見並不代表批准方案。') : copy('Visible only in your private demo. Nothing is published to the shared neighborhood.', '只會在你的私人示範顯示，沒有發佈到共同鄰里。')}</span></section>`;
  }
  async function refreshAuthorizedConcerns() {
    if (!state().workspace) return;
    const workspaceId = state().workspace.id;
    try {
      const latest = await api(`/api/state?participant=${encodeURIComponent(getSelected())}`);
      if (state().workspace?.id === workspaceId && latest.workspace?.id === workspaceId) {
        const card = document.querySelector('.authorized-concerns');
        if (card) card.outerHTML = authorizedConcerns(latest.contributors || []);
      }
    } catch { /* The explicit workspace refresh remains available; never show invented concerns. */ }
  }
  async function run(path, payload) {
    const result = await api(path, payload);
    if (result?.participants) context.setState(result); else await refresh();
    return result;
  }
  async function loadAgendaExtras() {
    const results = await Promise.allSettled([api('/api/agenda-watch'), api('/api/agenda-alerts')]);
    if (results[0].status === 'fulfilled') { const response = results[0].value; const value = Object.hasOwn(response, 'watch') ? response.watch : response; watch = value ? { ...value, topics: value.topics || (value.needs ? [value.needs] : []), areas: value.areas || value.streets || [] } : null; }
    if (results[1].status === 'fulfilled') alerts = results[1].value;
  }
  async function searchAgendas() {
    capture(); loading = true; featureError = ''; render();
    try { agendaData = await api(`/api/agendas?q=${encodeURIComponent(query)}&period=${period}`); }
    catch (error) { featureError = error.message; }
    finally { loading = false; render(); }
  }
  async function click(button) {
    const name = button.dataset.action;
    const names = ['open-join', 'close-join', 'confirm-join', 'private-space', 'phone-pair', 'review-share', 'keep-private', 'agenda-open', 'save-watch', 'refresh-alerts', 'read-alert', 'enable-push', 'disable-push', 'test-push', 'sync-workspace'];
    if (!names.includes(name)) return false;
    capture();
    try {
      if (name === 'open-join') { joining = true; render(); document.querySelector('#visitor-name')?.focus(); }
      if (name === 'close-join') { joining = false; render(); }
      if (name === 'confirm-join') {
        if (!document.querySelector('#join-consent')?.checked) { toast(copy('Review the shared-workspace disclosure first.', '請先審閱共同工作區說明。'), true); return true; }
        const displayName = document.querySelector('#visitor-name').value.trim();
        if (!displayName) { document.querySelector('#visitor-name').focus(); return true; }
        const perspective = document.querySelector('#join-perspective').value;
        await run('/api/join', { displayName, perspective }); context.setSelected(perspective); await refresh(); context.resetInputs(); pairing = null; joining = false; render();
      }
      if (name === 'private-space') { await run('/api/private', {}); context.resetInputs(); pairing = null; render(); }
      if (name === 'phone-pair') { pairing = await api('/api/phone/pair', { participant: getSelected(), language: getLanguage(), spokenLanguage }); render(); }
      if (name === 'review-share') { opened.add(state().self.draft.id); dismissed.delete(state().self.draft.id); render(); document.querySelector('.permission-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      if (name === 'keep-private') { dismissed.add(state().self.draft.id); opened.delete(state().self.draft.id); render(); toast(copy('Kept private. Nothing was sent to other advocates.', '保持私人。沒有向其他助手傳送內容。')); }
      if (name === 'agenda-open') { context.setView('evidence'); await loadAgendaExtras(); render(); document.querySelector('.agenda-panel')?.scrollIntoView({ block: 'start' }); }
      if (name === 'save-watch') {
        const list = id => document.querySelector(id).value.split(/[,，]/).map(v => v.trim()).filter(Boolean);
        const payload = { topics: list('#watch-topics'), areas: list('#watch-areas'), enabled: document.querySelector('#watch-enabled').checked };
        watch = (await api('/api/agenda-watch', payload)).watch || payload; toast(copy('Agenda watch saved.', '已儲存議程追蹤。')); render();
      }
      if (name === 'refresh-alerts') { await loadAgendaExtras(); render(); }
      if (name === 'read-alert') { await api(`/api/agenda-alerts/${encodeURIComponent(button.dataset.alertId)}/read`, {}); await loadAgendaExtras(); render(); }
      if (name === 'enable-push') {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(copy('This browser does not support push notifications. Use your agenda inbox.', '此瀏覽器不支援推播通知。請使用議程收件匣。'));
        const { publicKey } = await api('/api/push/key');
        if (!publicKey) throw new Error(copy('Browser notifications are awaiting server configuration. Your inbox remains available.', '瀏覽器通知尚待伺服器設定。仍可使用收件匣。'));
        toast(copy('Check your browser’s notification permission prompt. Your inbox remains available.', '請查看瀏覽器的通知許可提示。你仍可使用收件匣。'));
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error(copy('Notifications were not enabled. Your agenda inbox remains available.', '未開啟通知。仍可使用議程收件匣。'));
        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        const padded = publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4);
        const key = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
        const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api('/api/push/subscription', subscription.toJSON()); toast(copy('Browser notifications enabled.', '已開啟瀏覽器通知。'));
      }
      if (name === 'disable-push') {
        const registration = await navigator.serviceWorker?.getRegistration('/'); const subscription = await registration?.pushManager.getSubscription();
        await fetch('/api/push/subscription', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription?.endpoint }) }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); });
        await subscription?.unsubscribe(); toast(copy('Browser notifications turned off.', '已關閉瀏覽器通知。'));
      }
      if (name === 'test-push') { const response = await api('/api/push/test', {}); toast(response.message || copy('Test notification requested. Check this browser.', '已要求傳送測試通知。請查看此瀏覽器。')); }
      if (name === 'sync-workspace') { await refresh(); pendingRevision = null; render(); }
    } catch (error) { toast(error.message, true); }
    return true;
  }
  async function submit(event) {
    if (event.target.id !== 'agenda-search') return false;
    event.preventDefault(); query = document.querySelector('#agenda-query').value.trim(); period = document.querySelector('#agenda-period').value; await searchAgendas(); return true;
  }
  function noteChange(revision) { if (revision && revision !== state().revision) { pendingRevision = revision; capture(); render(); void refreshAuthorizedConcerns(); } }
  function captureFields(event) {
    if (event?.target?.id === 'phone-spoken-language' && ['en', 'yue', 'sq', 'auto'].includes(event.target.value)) { spokenLanguage = event.target.value; localStorage.setItem('cg-phone-language', spokenLanguage); }
    const ids = ['agenda-query', 'agenda-period', 'watch-topics', 'watch-areas', 'watch-enabled', 'visitor-name', 'join-perspective'];
    if (event?.target && ids.includes(event.target.id)) { dirtyFields.add(event.target.id); formFields[event.target.id] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; }
    for (const id of ids) { const field = document.getElementById(id); if (field && dirtyFields.has(id)) formFields[id] = field.type === 'checkbox' ? field.checked : field.value; }
  }
  return { mount, click, submit, noteChange, loadAgendaExtras, captureFields };
}
