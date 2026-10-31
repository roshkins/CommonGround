# CommonGround system design

Updated October 31, 2026. Implementation map for the hackathon demo. Source architecture is separate from verified deployment; the pitch ledger records evidence.

## Product boundary

An advocate listens privately, offers a shareable brief, and sends only the exact reviewed and explicitly authorized words to other advocates. People make their own current-version decisions. Fictional perspectives and scenario seeds never supply real owner consent.

```mermaid
flowchart LR
  Owner[Owner or demo visitor] --> Browser[Bilingual browser]
  Owner --> Phone[Paired phone call]
  Phone --> Private[Private participant state]
  Browser --> Private
  Private --> Review[Review exact brief]
  Review -->|Explicit authorization| Relay[Agent Relay advocates]
  Relay --> Proposal[Versioned proposal]
  Proposal --> Human[Human review and decision]
  Human --> State[Negotiation state]
  Official[Official published agendas] --> Index[Cited item and page extraction]
  Index --> Retrieval[Vector or labeled keyword retrieval]
  Retrieval --> Private
  Index --> Watch[Consented topic watch]
  Watch --> Inbox[Private alert inbox]
  Inbox -->|Separate browser permission| Push[Browser push]
  Inbox -->|Separate own-number call opt-in| Outbox[Durable agenda-call intent]
  Outbox -->|One attempt per alert and one per day| Twilio[Twilio outbound call]
  Twilio --> Notice[Generic notice in saved language]
  Notice -->|Fresh code for intended workspace| Phone
```

## Workspaces and durable state

The server resolves an opaque visitor session. Participant state keeps private drafts, language, phone pairing and watch preferences. Negotiation state keeps authorized briefs, versions, contributor decisions, receipts and public contribution history. Terse is selected explicitly; local SQLite is a separately labeled mode, not an invisible fallback.

Private is the default. Joining the shared neighborhood is explicit and begins as observation. Authorizing a reviewed brief enrolls the visitor as a contributor. Fictional business perspective and visitor identity are separate. Shared votes count actual contributors and are version-bound. Visitors cannot reset shared history.

Optimistic revision checks reject stale writes. New authorized context makes an old proposal stale. Unsent browser text survives refresh prompts. A reviewed send is stored as an intent before Relay dispatch; failed sends remain recoverable without falsely publishing the brief or repeating a successful send.

## Browser and phone interfaces

State actions remain revisioned: understand, share, negotiate, decision and revise. Cookie-scoped interfaces add workspace join/return, phone pairing, agenda search, watch consent, alert read state and optional push subscriptions. The browser never receives a Supabase service key.

The phone card displays only a server-provided number and expiring keypad pairing code. Pairing links the call to the selected perspective, language and workspace. Voice intake does not authorize cross-advocate sharing. The phone review reads the exact brief and requires an explicit confirmation key after playback; the browser also offers editable exact-brief review and explicit consent.

The added public features module mounts workspace, phone, proactive share and agenda controls around the existing guided interface. The service worker handles optional push and opens the same-origin Evidence view; it does not cache private API responses.

## Agenda evidence and alerts

The bounded corpus uses official SFMTA meeting pages and agenda/minutes PDFs. Extraction preserves meeting date, original URL, item and PDF page. Past discussion and published upcoming agendas are searchable. Scheduled meetings without published agendas remain awaiting publication; future agenda contents are never synthesized.

Supabase vector retrieval and cited local keyword retrieval carry distinct modes. Initial corpus/watch population produces baseline inbox matches without pretending old documents are new publications. Later relevant changes are deduplicated and can enqueue push only for visitors who separately enabled it. Server-managed delivery retries, expired subscriptions and read state keep status honest.

Opted-in agenda calls are a separate delivery channel, deployed at 3:09:50 p.m. Pacific. A recent code-paired inbound number plus explicit own-number consent is required. The worker persists a call intent before its single Twilio creation attempt; ambiguous outcomes are not automatically redialed. Automatic calls are capped at one per day. Explicit manual labeled tests are separately capped at three per hour, require a terminal prior test and fresh confirmation, and never retry active/unknown calls automatically. An answerer can stop future calls with keypad 9. No private history or agenda details are spoken before a fresh code binds the intended workspace. After pairing, the exact triggering alert supplies title, passage, meeting date, source URL, item and page to Live. The user-only test endpoint labels an existing source as TEST and uses the separate manual-test cap. A real user test rang and fresh-code paired in English for 171 seconds, but source awareness failed. The 3:29:20 correction deterministically announces the exact trigger title/date/item/page after code validation and starts Live trigger-first without old history. Thirty-seven isolated checks pass; actual source-awareness retest remains pending.

## Verification and timing

On October 31, 17 isolated workspace/agenda tests and public JavaScript syntax checks passed. The hosted private integration proof completed at 1:17 p.m. Pacific and verifies session isolation, six actual Relay receipts, a contributor decision, bilingual revision, approval reset, stale-version rejection and past/upcoming Supabase vector retrieval. The lead also verified genuine Terse runtime restart persistence and hosted source-card rendering. Actual inbound calls now verify code-first flow, exact brief consent and visible private/shared delivery; outbound ringing/pairing is also verified. Source awareness failed in the latest outbound test; its correction is deployed but not carrier-retested. One-page browser QA and actual receipt/watch/inbox UI passed; browser push remains unverified.

The 3 p.m. ready target passed after late critical requests; the deadline remains 4 p.m. Pacific. Code is frozen except blocking bugs. The selected 142-word real-story pitch is awaiting new voice/timing validation; the prior 139-word audio is preserved at 53.95 seconds. A 20-second feature opener plus the technically verified 97.77-second native body targets 117.77 seconds. Opening footage is being rerecorded after failed visual QA; completion must be confirmed by media before delivery. The user uploads manually as unlisted and supplies the link.

Latest operational status (October 31, 3:34 p.m. Pacific): A user-triggered real outbound test rang, completed fresh English-code pairing, and lasted 171 seconds in the shared workspace. Carrier delivery/pairing is verified; source awareness failed according to the caller. The 3:29:20 p.m. correction announces the exact agenda title/date/item/page after pairing, starts Live with the triggering item first, excludes old history from that startup, and adds deterministic verified-share confirmation. Thirty-seven isolated checks pass; the actual carrier retest after this correction remains pending. Browser preview audio played technically; that does not prove a telephone call or source understanding.
