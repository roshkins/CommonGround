# CommonGround

**Your voice. Your AI advocate. Your approval.** CommonGround helps neighboring businesses express their needs, find relevant public agendas, and explore a shared civic proposal. Agents propose; people approve the current proposal version.

Start with the **[single-page judge walkthrough](https://commonground-ac9dc2.style.dev/judge.html)** or the **[live workspace](https://commonground-ac9dc2.style.dev)**. No account is required. Each browser receives a signed private visitor session; this is demo identity, not verified business ownership.

Updated October 31, 2026. Submission-ready target: **3 p.m. Pacific**, before the reported **4 p.m. deadline**. Feature freeze is **1:45 p.m.**; the final hour is reserved for rehearsal and last touches. The deployment is authorized for a six-hour demo window.

## Demo flow

1. Start in your private workspace. Choose a fictional business perspective and an English or Traditional Chinese interface.
2. Describe a concern by text, browser recording, or a paired inbound phone call. The phone advocate can attempt the caller's spoken language independently of the screen locale. Generate a pairing code in your workspace, call the displayed demo number, and enter the code. Authenticated conversations are limited to eight minutes (480 seconds).
3. Review the advocate's proposed brief. Keep it private or explicitly authorize the exact text. Phone sharing requires full readback followed by keypad **1**; a request to prepare a review does not authorize sending.
4. Stay private or opt into the shared neighborhood negotiation. Joining initially makes you an observer. Publishing an authorized brief enrolls your visitor as a contributor. Shared briefs, proposal versions, and prior visitor decisions form an evolving shared context; private drafts and call transcripts stay private.
5. Explore a compromise using live OpenAI advocates and actual Agent Relay messages. Inspect the concrete terms, unresolved issues, source citations, and delivery receipts.
6. Approve, reject, or request changes for the exact current proposal version. Decisions belong to individual contributing visitors. Fictional seed businesses supply scenario context and have no votes. Changed terms or contribution context require fresh review.
7. Search past agendas and published upcoming agendas. Save needs and areas to watch for relevant updates. A scheduled meeting without a published agenda is labeled accordingly.
8. Separately opt in to calls to your own recently paired number in English, Cantonese or Albanian. Newly relevant publications can trigger a real Twilio call in the saved language. The generic notice reveals no private history; enter a fresh workspace code before discussing the exact triggering source. The judge page also offers an explicit, labeled test using an existing source. A test request is not proof of an answered call; real outbound delivery awaits caller verification.

The fictional personas, market terms, and demo visitor decisions do not establish real business consent or official permit requirements. Rehearsal mode and simulated transport remain visibly labeled; live failures do not silently become simulations.

## Architecture and current evidence

- **Freestyle VM:** Linux with Node **22.23** for the application and Relay native SQLite compatibility; Bun runs the Terse actor runtime. HTTPS application and voice routes reach separate local services. Actor and Relay endpoints remain private.
- **Genuine Terse Durable Actors:** participant state, private/shared negotiations, membership, version decisions, and phone pairing directory use actual Terse actors with persisted fields and compare-and-set writes. The hosted demo uses the self-hosted persistent development runtime on the VM, not Terse managed cloud. A write/restart/read smoke test verified state and approval survival plus visitor isolation.
- **OpenAI:** `gpt-6.1-terra` powers advocate reasoning and proposals. Responses requests use server-side keys and `store: false`. Browser recordings use transcription; phone dialogue uses **GPT Live through Twilio Agent Connect**, with deterministic exact-brief playback and keypad consent outside the model.
- **Agent Relay:** the official Relaycast engine carries reviewed briefs and advocate requests/replies between distinct advocate identities. Recipients read their messages back; the interface shows receipts. Durable send intents support retries without silently authorizing different words.
- **Supabase pgvector:** official SFMTA ISCOTT and Citizens' Advisory Council documents are indexed for cited retrieval. The verified hosted corpus currently contains **7 documents and 53 chunks**. Past and upcoming searches have returned actual `supabase-vector` results with item/page citations. A cited local keyword fallback is labeled when used.
- **Agenda watches:** a persistent worker polls every **15 minutes**. Baseline documents populate the private inbox without being treated as newly published alerts. New relevant matches use deduplication and a durable delivery outbox. Browser push is opt-in; end-to-end browser delivery remains unverified.
- **Supporting SQLite storage:** the VM retains the agenda cache, notification outbox, and Relay engine data. Explicit local SQLite workspace mode is available for development; it is distinct from the deployed actor mode.
- **Live API flow:** `/service-flow.html` polls session-scoped operation metadata every two seconds. The deployed view was opened and checked at 2:05 p.m.; an actual search produced an OpenAI embedding operation at 582 ms and Supabase retrieval at 864 ms. This is current-process activity, not a durable request archive. Concern text, transcripts, queries, call identifiers and secrets are excluded. Freestyle is labeled as the deployment host, not an API request for every action.
- **Not used:** Mastra has no application integration or declared dependency; the implementation audit found no code references before documenting this fact. Superserve is also unused. Do not include either in claims about the working sponsor stack.

A hosted private integration run completed in **49.97 seconds**, including live model calls, **six verified Relay receipts**, visitor isolation, bilingual proposal revision, fresh-version approval reset, stale-version rejection, and both retrieval periods. See [the recorded proof](artifacts/hosted-proof.json).

## Current demo, pitch and call evidence

The deployed [one-page judge guide](https://commonground-ac9dc2.style.dev/judge.html) contains all six steps, the exact five equally weighted judging categories, actual agenda/source retrieval, authorized concerns, private watch/inbox and safe current-process API activity. Its local prepared simulation is labeled; exact consent blocks agent exchange, and a material proposal revision resets simulated approval. Real private concern delivery showed two verified Relay receipts. No government filing or real proposal approval is implied.

The real 334-second English inbound and 148-second shared calls verified exact brief revision/authorization and board visibility. Current actual-call private V3/shared V1 proposals remain pending human review. Earlier isolated hosted proof separately verifies approval/reset behavior. The old 181-second maximum-duration result belongs to an earlier three-minute cap; current phone cap is eight minutes.

The final real English outbound retest completed in 84 seconds. The user confirmed it responded and discussed the correct agenda. Saved evidence contains two user and two assistant turns, 3,556 received/input-forward attempts, 217 nonquiet frames, 15 user transcript deltas and zero errors. Carrier delivery, fresh pairing, source awareness and the reply path are now verified for this English test. No brief review or send happened in this retest: deterministic spoken receipt confirmation remains implementation/38-test evidence only. Earlier real inbound key-1 authorization separately delivered two verified Relay receipts.

Automatic matching-agenda calls are capped at one per day. Manual labeled tests allow at most three per hour, only after the prior test is terminal and the user gives a fresh explicit confirmation. Active or unknown calls are not retried automatically. Existing-document tests remain labeled TEST; they are not new publications.

A saved private matching agenda watch and separate verified-own-number call opt-in are required for automatic calls. Saving or baseline ingestion does not dial. The on-page browser audio preview technically played at 3:30 p.m. (10.45 seconds, readyState 4, paused false, no error); that is not carrier-call evidence. Browser-push delivery remains unverified. Caller turn-taking criticism and broad language quality are not erased by isolated tests.

The selected [142-word real-story pitch](docs/pitch-script.txt) begins with the reported 2024 Chinatown incident; its selected voice is generated at 54.20 seconds WAV / 54.23 seconds MP3, with about 5.8 seconds under 60. The prior 139-word push-first pitch and its [53.95-second WAV](artifacts/pitch-push-first-master.wav) / [about 54-second MP3](artifacts/pitch-push-first-master.mp3), plus the older 53.1-second track, remain preserved.

The selected updated 117.766667-second video has passed media decode/visual QA. Its opening shows controls and an earlier private brief’s verified receipts, not an outbound conversation; its body uses an earlier inbound call and later same-private-workspace UI. Final hosted MP4 range 206 / 7,222,801 bytes and VTT 200 are verified; user manual unlisted upload/link remain pending.

Public hosting and unlisted YouTube upload are authorized, but the user is uploading manually and must provide the watch link. The assistant does not sign in, upload, or submit the event entry. See [submission checklist](docs/submission.md). Specific user-approved OpenAI transcription yielded 686 words/43 segments after a PCM-format retry; the user recording was not copied to the VM.

## Run locally

Use Node **22.23** for installation and execution so Relay's native SQLite binary matches the runtime:

```powershell
npm ci
Copy-Item .env.example .env
npm run setup:secrets
node scripts/start-local.mjs
```

Fill in `.env` before starting. The combined launcher starts the app on `http://127.0.0.1:3000` and the official local Relay engine. It does not start Terse, phone voice, or a scheduler. Stop owned processes with Ctrl+C; do not stop unrelated processes occupying a port.

The example selects `WORKSPACE_STORAGE=sqlite` for explicit local development. For genuine actors, use Linux/WSL with Bun 1.4.2 or later, set `WORKSPACE_STORAGE=terse`, `TERSE_ACTOR_URL=http://127.0.0.1:7100/v1/projects/commonground/actors`, and a server-side `TERSE_API_KEY`, then run `npm run actors` separately. Use the same actor URL and key in the app configuration. The actor launcher refuses to silently substitute SQLite when actors are unavailable.

For the hosted topology, [scripts/freestyle-services.sh](scripts/freestyle-services.sh) defines separate actor, Relay, application, voice, and scheduled agenda services. Deployment is an explicit operation; installing dependencies does not deploy anything.

## Server configuration

Use [.env.example](.env.example) for variable names. Keep `.env`, `data/`, runtime keys, pairing capabilities, and recordings out of source control and public assets. Browser code never receives provider or database service keys.

| Integration | Server settings |
| --- | --- |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_LIVE_MODEL`, `OPENAI_LIVE_VOICE` |
| Terse | `TERSE_ACTOR_URL`, `TERSE_API_KEY`, `WORKSPACE_STORAGE=terse` |
| Supabase corpus | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; provision [the corpus schema](supabase/schemas/agendas.sql) before indexing. Use a backend service credential, never an anonymous/public key. |
| Relay | `RELAY_BASE_URL`; `RELAY_WORKSPACE_KEY` is optional for the owned local engine, which maintains its own private credentials. |
| Inbound phone | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_PHONE_NUMBER`, `VOICE_PUBLIC_ORIGIN`, `VOICE_PORT` |
| Hosting/session bridge | `PUBLIC_ORIGIN`, `HOST`, `PORT`, `DATA_DIR`, `INTERNAL_API_TOKEN`; the same private bridge token must be available to app and voice services. |
| Optional browser push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; public VAPID key may reach the browser, private key must stay on the server. |
| Freestyle deployment tooling | `FREESTYLE_API_KEY`; needed by deployment scripts, not exposed to visitors. Superserve is not part of the current runtime. |

Twilio webhooks must target the configured HTTPS application `/phone/incoming` route; the separate voice domain handles TwiML/WebSocket traffic. Webhooks are signature-checked. The bridge accepts only paired calls and trusted internal requests. Deployment configuration, provider access, and installed packages alone are not proof of working calls or retrieval.

## Validation and remaining gates

```powershell
npm run check
npm test
```

The test suites use isolated storage, stubbed model/phone providers, and local HTTP fixtures; they do not place calls or spend model credits. Some HTTP checks require local loopback access. Phone/workspace coverage includes original Albanian brief retention, full-playback-before-keypad consent, stale-draft refusal, private state, shared membership, version decisions, and send retries. The separate Relay integration check requires a running local engine:

```powershell
node tests/relay.integration.mjs
```

Hosted validation is separate from isolated tests. Actual model/Relay, vector retrieval, actor restart, inbound brief authorization and outbound ringing/pairing are verified. The final 84-second English outbound test was responsive and agenda-aware, confirmed by the user, with two user/two assistant turns and zero errors. No brief review/send happened in that retest; deterministic spoken receipt remains implementation/test evidence. Browser push and final updated-video/upload checks remain open.

Pitch and demo scripts are maintained in [docs/pitch.md](docs/pitch.md) and [docs/demo-video.md](docs/demo-video.md): **60-second pitch + two-minute video**. The native body is recorded/technically validated; the updated 117.77-second cut has passed media decode/visual QA; hosted replacement verification passed (MP4 range 206 / 7,222,801 bytes; VTT 200). Public hosting and manual unlisted upload are already authorized; the user provides the watch link and controls event submission.

## Sources

- [SFMTA public meetings](https://www.sfmta.com/meetings) provide the agenda corpus; source cards retain meeting/document/item/page links.
- Historical inspiration: [Wind Newspaper, April 29, 2024](https://www.windnewspaper.com/article/chinatown-night-market-approved-to-expand-to-5-blocks-on-grant-avenue-despite-opposition-from-neighbors-and-no-community-outreach). Reporting is distinct from official requirements and invented scenario constraints.
- [OpenAI Responses](https://developers.openai.com/api/docs/guides/text), [Live delegation](https://developers.openai.com/api/docs/guides/live-delegation), and [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text).
- [Official Relaycast engine and SDK](https://github.com/AgentWorkforce/relaycast) and [Terse Durable Actors](https://docs.useterse.ai/quickstart).

Public source: [roshkins/CommonGround](https://github.com/roshkins/CommonGround), anonymous read verified. The public snapshot excludes credentials, runtime data and user recordings/video/captions.

[Hosted demonstration video](https://commonground-ac9dc2.style.dev/demo-final.mp4) (117.766667 seconds; user-authorized public hosting). Video, user audio and captions are intentionally excluded from GitHub.

The isolated test suite runs without credentials or paid provider calls. In a public clone, one video HTTP integration test explicitly skips because the generated user-voice MP4 and captions are omitted for privacy; the same test runs when both private export assets are present. Production video seeking/range delivery is verified separately against the hosted artifact.

## Public source snapshot

This repository intentionally excludes local credentials, runtime data, private diagnostics, user recordings/transcripts, and the hosted demo video/captions. Local production artifact links in development notes are not included in this source snapshot. View the deployed application and optional recorded demonstration through the [one-page judge guide](https://commonground-ac9dc2.style.dev/judge.html). No new license is asserted by this publication.
