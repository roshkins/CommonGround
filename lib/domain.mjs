import { randomUUID } from 'node:crypto';

export const SOURCE_URL = 'https://www.windnewspaper.com/article/chinatown-night-market-approved-to-expand-to-5-blocks-on-grant-avenue-despite-opposition-from-neighbors-and-no-community-outreach';
export const LANGUAGES = ['en', 'zh-Hant'];
export const PEOPLE = [
  { id: 'tea', name: 'Lantern Tea', owner: 'Mei', initials: 'LT', kind: 'tea', language: 'zh-Hant',
    role: { en: 'Tea shop · More foot traffic', 'zh-Hant': '茶店 · 希望增加人流' },
    seed: { en: 'I want the street market to bring more people to our tea shop. We can stay open until 9 pm. I am open to a later start if customers can still find us.', 'zh-Hant': '我希望街市能為茶店帶來更多人流。我們可以營業到晚上九點。如果顧客仍能找到我們，我可以接受較晚開始。' } },
  { id: 'garage', name: 'Pacific Garage', owner: 'Alex', initials: 'PG', kind: 'garage', language: 'en',
    role: { en: 'Garage · Keep access open', 'zh-Hant': '停車場 · 保持出入口暢通' },
    seed: { en: 'I support bringing people to the neighborhood, but cars must be able to enter our garage. Deliveries need access until 6 pm. Could the market start after deliveries and keep a signed garage route?', 'zh-Hant': '我支持吸引更多人到社區，但車輛必須能進入停車場。送貨車需要通行至下午六點。街市可否在送貨結束後開始，並保留有指示牌的停車場通道？' } },
  { id: 'craft', name: 'Jade & Paper', owner: 'Lin', initials: 'JP', kind: 'craft', language: 'zh-Hant',
    role: { en: 'Craft shop · Less disruption', 'zh-Hant': '手工藝店 · 減少干擾' },
    seed: { en: 'Please keep our storefront clear so visitors can come inside. I worry about amplified music late at night. I could support a two-event trial with music ending at 9 pm and a clear walking path.', 'zh-Hant': '請保持店門前暢通，讓顧客可以進店。我擔心深夜的擴音音樂。如果音樂在晚上九點結束，並保留清晰的步行通道，我可以考慮試辦兩次。' } },
];

// Curated paraphrases of reporting, not official permit requirements.
export const EVIDENCE = [
  { id: 'notice', title: { en: 'A notice is only useful if people can read it', 'zh-Hant': '通知要讓人看得懂，才有用' },
    text: { en: 'The April 29, 2024 report describes English-only notices and merchants learning about the proposal shortly before public-comment deadlines.', 'zh-Hant': '2024年4月29日的報道提到只有英文的通知，以及商戶在公眾意見截止前不久才得知方案。' }, type: 'reported', url: SOURCE_URL },
  { id: 'access', title: { en: 'More visitors, different access needs', 'zh-Hant': '更多訪客，不同的通行需要' },
    text: { en: 'A garage owner reported benefiting from market visitors while opposing the added closure because it would change vehicle access.', 'zh-Hant': '一名停車場經營者表示街市帶來更多顧客，但反對新增封路，因為這會改變車輛的進出路線。' }, type: 'reported', url: SOURCE_URL },
  { id: 'participation', title: { en: 'Being invited is different from being heard', 'zh-Hant': '獲邀參與，不代表能夠發聲' },
    text: { en: 'The report describes a merchant who could not speak during the online hearing because of technical difficulties.', 'zh-Hant': '報道描述一名商戶因技術困難，未能在網上聽證會發言。' }, type: 'reported', url: SOURCE_URL },
];

export function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
export function text(value, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `Enter between 1 and ${max} characters.`);
  return value.trim();
}
export function person(id) { const p = PEOPLE.find(p => p.id === id); if (!p) fail(400, 'Unknown demo participant.'); return p; }
export function language(value) { if (!LANGUAGES.includes(value)) fail(400, 'Choose English or Traditional Chinese.'); return value; }
export function restricted(input) {
  // Conservative demo gate; model-side screening supplements this in live mode.
  return /(price[- ]?fix|fix\w*\s+(our\s+|the\s+)?prices|agree\w*\s+(on\s+)?(prices|wages)|set\s+(our\s+|the\s+|a\s+)?(prices|wages)|divide\w*\s+(the\s+)?(customers|market)|allocat\w*\s+(customers|market)|boycott|cartel|collud|coordinate\w*\s+(prices|wages)|wage[- ]?fix|分配客戶|瓜分市場|聯合定價|統一定價|固定價格|協調工資|垄断|壟斷|统一价格)/iu.test(input);
}
export function assertCivic(input) {
  if (restricted(input)) fail(422, 'This workspace is for civic access and event proposals. Commercial coordination on prices, wages, customers, or market allocation cannot be shared. / 此工作區只用於公共通行及活動方案，不可協調價格、工資、客戶或市場分配。');
}
export function createRoom() {
  return {
    id: randomUUID(), revision: 0, createdAt: new Date().toISOString(),
    participants: Object.fromEntries(PEOPLE.map(p => [p.id, { language: p.language, draft: null, shared: null, shareRevision: 0 }])),
    proposals: [], decisions: [], exchanges: [], events: [],
  };
}
export function currentProposal(room) { return room.proposals.at(-1) ?? null; }
export function proposalStale(room) {
  const p = currentProposal(room);
  return Boolean(p && PEOPLE.some(x => p.shareRevisions[x.id] !== room.participants[x.id].shareRevision));
}
export function approvals(room) {
  const p = currentProposal(room);
  return PEOPLE.map(x => {
    const decision = p && room.decisions.findLast(d => d.participant === x.id && d.version === p.version);
    return { participant: x.id, status: proposalStale(room) ? 'outdated' : decision?.status ?? 'pending', note: decision?.note ?? '', version: p?.version ?? null };
  });
}
export function publishView(room, selected) {
  person(selected);
  return {
    id: room.id, revision: room.revision, createdAt: room.createdAt,
    participants: PEOPLE.map(p => ({ ...p, language: room.participants[p.id].language, shared: room.participants[p.id].shared, shareRevision: room.participants[p.id].shareRevision })),
    // Raw concerns are never included in the cross-participant view or exchange.
    self: { id: selected, ...room.participants[selected] },
    proposal: currentProposal(room), proposalStale: proposalStale(room), approvals: approvals(room),
    allApproved: Boolean(currentProposal(room) && approvals(room).every(a => a.status === 'approved')),
    exchanges: room.exchanges.slice(-12), events: room.events.slice(-20), evidence: EVIDENCE,
  };
}
export function addEvent(room, type, detail = {}) {
  room.events.push({ id: randomUUID(), type, at: new Date().toISOString(), ...detail });
}
export function shareBrief(room, { participant, brief, consent, draftId }) {
  person(participant);
  if (consent !== true) fail(400, 'Review and explicitly authorize the exact text before sharing.');
  const own = room.participants[participant];
  if (!own.draft || own.draft.id !== draftId) fail(409, 'Your understanding changed. Review it again before sharing.');
  brief = text(brief, 3000); assertCivic(brief);
  if (own.draft.understanding.allowed !== true) fail(422, 'This concern cannot be shared for cross-business negotiation.');
  if (own.shared?.text === brief) return;
  own.shareRevision += 1;
  own.shared = { text: brief, language: own.language, authorizedAt: new Date().toISOString(), draftId, revision: own.shareRevision };
  addEvent(room, 'shared', { participant });
}
export function addProposal(room, content, mode, transport) {
  if (PEOPLE.some(p => !room.participants[p.id].shared)) fail(409, 'Each demo owner must authorize a brief before negotiation.');
  for (const lang of LANGUAGES) {
    const localized = content?.[lang];
    if (!localized || typeof localized.title !== 'string' || !localized.title.trim()) fail(502, 'The bilingual proposal is incomplete.');
    for (const field of ['terms', 'tradeoffs', 'unresolved', 'evidenceIds']) {
      if (!Array.isArray(localized[field]) || localized[field].some(value => typeof value !== 'string')) fail(502, 'The proposal contains invalid terms.');
    }
    if (!localized.terms.length || !localized.unresolved.length) fail(502, 'The proposal must include terms and unresolved issues.');
    if (localized.evidenceIds.some(id => !EVIDENCE.some(e => e.id === id))) fail(502, 'The proposal referenced unknown evidence.');
    assertCivic([localized.title, ...localized.terms, ...localized.tradeoffs, ...localized.unresolved].join(' '));
  }
  const p = { id: randomUUID(), version: room.proposals.length + 1, content, mode, transport,
    shareRevisions: Object.fromEntries(PEOPLE.map(p => [p.id, room.participants[p.id].shareRevision])), createdAt: new Date().toISOString() };
  room.proposals.push(p); addEvent(room, 'proposal', { version: p.version }); return p;
}
export function recordDecision(room, { participant, version, status, reviewed, note = '' }) {
  person(participant);
  const p = currentProposal(room);
  if (!p || p.version !== version || proposalStale(room)) fail(409, 'This proposal changed. Review the current version before deciding.');
  if (reviewed !== true) fail(400, 'Confirm you reviewed this exact proposal version.');
  if (!['approved', 'rejected', 'revise'].includes(status)) fail(400, 'Choose approve, reject, or request revision.');
  if (status === 'approved' && p.translationPending) fail(409, 'The manual revision needs bilingual review. Generate a live bilingual option before approving. / 手動修訂需要雙語審閱，請先產生即時雙語方案。');
  if (typeof note !== 'string' || note.length > 2000) fail(400, 'Decision note is too long.');
  assertCivic(note);
  room.decisions.push({ id: randomUUID(), participant, version, status, note: note.trim(), at: new Date().toISOString(), actor: 'demo-operator' });
  addEvent(room, 'decision', { participant, version, status });
}
export function rehearsalProposal() {
  return {
    en: { title: 'A market that makes room for everyone', terms: [
      'Try two market evenings, then invite every business to review the impact.',
      'Begin street closure after 6 pm, preserving the delivery window.',
      'Keep a signed vehicle route to the garage, subject to city review of the route and safety.',
      'Keep storefront entrances and a continuous pedestrian path clear.',
      'End amplified music at 9 pm and share notices in English and Traditional Chinese.'
    ], tradeoffs: ['A later start shortens the market but preserves afternoon access.', 'A garage route may reduce stall space; its feasibility is unresolved.'], unresolved: ['Illustrative rehearsal option: confirm every term against the actual owner briefs.', 'City review of traffic routing, emergency access, permits, and the event schedule is still required.'], evidenceIds: ['notice', 'access', 'participation'] },
    'zh-Hant': { title: '為每個人留出空間的街市', terms: [
      '先試辦兩晚街市，再邀請每家商戶檢視影響。', '下午六點後才開始封路，保留送貨時段。',
      '保留有指示牌的停車場行車路線，路線及安全安排須由市府審查。', '保持店舖出入口及連續的行人通道暢通。',
      '擴音音樂在晚上九點結束，並以英文及繁體中文發佈通知。'
    ], tradeoffs: ['較晚開始會縮短街市時間，但可保留下午的通行。', '停車場通道可能減少攤位空間；可行性仍待確認。'], unresolved: ['此為示範方案：請逐項核對是否符合商戶授權的意見。', '行車路線、緊急通道、許可及活動時間仍須市府審查。'], evidenceIds: ['notice', 'access', 'participation'] },
  };
}
