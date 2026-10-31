# CommonGround pitch

Updated October 31, 2026, 3:46 p.m. Pacific. Format: a 60-second pitch and a two-minute-budget demo. The **3 p.m. ready target has passed following late critical requests**; submission still closes at the reported **4 p.m. Pacific** deadline. The latest real 84-second English outbound test was responsive and agenda-aware, confirmed by the user. The 117.77-second updated demo has passed media QA; hosted replacement verification has passed; manual YouTube upload remains pending.

## Current real-story spoken pitch

In 2024, San Francisco’s Chinatown merchants faced English-only street-closure notices. A garage owner learned about the proposal one day before comments closed; another merchant couldn’t speak at the online hearing.

Reported source: [Portia Li, Wind Newspaper, April 29, 2024](https://www.windnewspaper.com/article/chinatown-night-market-approved-to-expand-to-5-blocks-on-grant-avenue-despite-opposition-from-neighbors-and-no-community-outreach). The reporting describes English-only notices, garage owner Michael Lau learning about the application one day before the comment deadline, and merchant Neville Zhang being unable to speak because of online-hearing technical issues. CommonGround addresses that real participation problem; its demo businesses and negotiation terms are fictional. It has not been deployed to those merchants and has no demonstrated policy outcome.

CommonGround watches published agendas for what matters to each business. When a new item matches their saved needs, it triggers an opted-in phone call in the owner’s chosen language. Their advocate explains the cited item, listens, and turns the discussion into a short brief.

The owner reviews the exact words before sharing. Verified receipts confirm the brief reached the other advocates. They work through conflicting needs and bring back a concrete compromise, with trade-offs and unresolved issues visible.

Sharing a concern isn't approving a proposal. People approve the exact version; change the terms, and approval resets.

CommonGround turns public information into a conversation that fits an owner's day. Agents propose. People approve.

[Selected 142-word real-story script](pitch-script.txt). Selected voice is generated and timing-validated: [54.20-second WAV](../artifacts/pitch-real-story-master.wav) / [54.23-second MP3](../artifacts/pitch-real-story-master.mp3), leaving about 5.8 seconds under the minute. The prior [139-word push-first script](../artifacts/pitch-push-first-draft.txt) and its [53.95-second WAV](../artifacts/pitch-push-first-master.wav) / [54.0-second MP3](../artifacts/pitch-push-first-master.mp3) remain preserved; those recordings do not yet contain this real-story opening.

## Exact judging criteria

Names and equal weights are from the judging dashboard screenshot supplied by the user.

| Criterion | Weight | Evidence and honest boundary |
| --- | --- | --- |
| Use of Real-Time AI and Track Technology | 20% | Actual GPT Live calls, Terra reasoning, Terse state, Relay receipts and Supabase vectors. Prepared walkthrough playback is distinct from fresh live AI. |
| Originality and Creativity | 20% | Personal advocates connect language access, public agenda context and exact sharing permission. Opt-in agenda-triggered outbound calling and the labeled own-number test have 38 isolated checks. The final 84-second English outbound test verified ringing/pairing, a specific source greeting and responsive agenda discussion, confirmed by the user. |
| Execution and Demo | 20% | Real phone-to-web authorization, visible concerns, proposal generation, isolated version/reset tests and actual API metadata. Current real-call proposals remain pending human approval. |
| User Experience and Design | 20% | Phone-first flow and a new six-step one-page judge guide, with exact consent before agent exchange. Caller criticism of turn-taking remains a quality gate. |
| Potential and Impact | 20% | Civic participation and coordination are the intended impact. No merchant outcome study, savings claim or million-user load test has been performed. |

## Current capability ledger

| Capability | Verified evidence | Remaining limit |
| --- | --- | --- |
| Real inbound phone flow | A 334-second English call used code-first pairing without a redundant chooser, cited agenda context, early brief offer, key 2 revision and key 1 authorization; two actual Relay receipts | Caller reported being interrupted/bulldozed. The later 84-second English outbound retest was confirmed responsive; no broad language-quality study |
| Private/shared concern boards | Private authorized concerns are visible only in that workspace; a separate 148-second shared call placed its authorized concern on the shared board for an observer | Raw calls and unapproved drafts are excluded. Changing a private brief's audience requires fresh consent |
| Human proposal decisions | Earlier [hosted integration proof](../artifacts/hosted-proof.json) verifies approval/reset, stale-version rejection and isolation | Actual-call private V3 and shared V1 are pending; no human proposal approval occurred in those captures |
| Terse / Relay / Supabase | Genuine actor restart persistence, actual Relay receipts, and past/upcoming vector retrieval with official item/page citations are verified | Architecture is not a scale/load-test result |
| Live API flow | Actual phone wire, model, embedding and retrieval operations shown as safe current-process metadata | No concerns, queries, transcripts, call identifiers or simulated traffic |
| One-page judge guide | Deployed [judge guide](https://commonground-ac9dc2.style.dev/judge.html); browser QA passed at 3:07 p.m.: exact five 20% criteria, live Winter Walk source, actual private concern, consent guard and simulated V1→V2 approval reset | Fictional outbound scene, owner consent and proposal decisions stay explicitly simulated. Prepared run contains four actual Terra responses and four isolated Relay receipts, not new calls on every replay |
| Real opt-in agenda-triggered outbound calls | Final 84-second English test completed with two user/two assistant turns; user confirmed responsive, agenda-aware discussion; zero errors | No brief review/send in this retest. Spoken receipt confirmation is implementation/38-test evidence; earlier inbound key-1 sharing separately verified two Relay receipts |
| Agenda inbox / push | Real private watch/inbox and receipt UI deployed; actual private brief showed two verified Relay receipts. Browser audio preview technically plays (10.45 s, ready state 4, no error) | Browser-push delivery remains unverified; the successful carrier retest is English-only; browser audio is not call proof |
| Recording transcription | Specific OpenAI transcription authorized by the user; PCM-format retry produced 686 words and 43 timestamped segments | User-provided recording was not copied to the VM |
| Video | Native 97.77 s body is technically validated. Selected new 117.77 s cut passed media decode/visual QA | Final hosted MP4 range 206 / 7,222,801 bytes and VTT 200 verified; user manual unlisted upload/link still pending |

## Stack and language boundaries

Working stack: OpenAI GPT Live (`gpt-live-1`) and `gpt-6.1-terra`, Twilio Agent Connect, Agent Relay/Relaycast, genuine self-hosted Terse Durable Actors on Freestyle, and Supabase pgvector over official SFMTA material. **Mastra and Superserve are unused.** Freestyle is the host, not an API call per interaction.

The written interface offers English and Traditional Chinese. The phone picker offers English, 粵語, Shqip and Auto; only the reported English functional test is user-assessed. The user does not speak Albanian. No broad language-quality claim is supported.

The agents propose; people approve the current version. Fictional roles and visitor decisions never establish real-business consent. Use [submission checklist](submission.md) to close the remaining delivery gates before 4 p.m.

The final real English outbound retest completed in 84 seconds. The user confirmed it responded and discussed the correct agenda. Saved evidence contains two user and two assistant turns, 3,556 received/input-forward attempts, 217 nonquiet frames, 15 user transcript deltas and zero errors. Carrier delivery, fresh pairing, source awareness and the reply path are now verified for this English test. No brief review or send happened in this retest: deterministic spoken receipt confirmation remains implementation/38-test evidence only. Earlier real inbound key-1 authorization separately delivered two verified Relay receipts.

Current sharing feedback: the actual concerns panel says “Brief shared” only when the current exact authorized brief has matching verified Relay receipts for its recipient targets. Missing/partial current receipts are labeled; nothing is described as filed with government or as proposal approval.

Automatic matching-agenda calls are capped at one per day. Manual labeled tests allow at most three per hour, only after the prior test is terminal and the user gives a fresh explicit confirmation. Active or unknown calls are not retried automatically. Existing-document tests remain labeled TEST; they are not new publications.

## Latest change log

- October 31, 3:34 p.m.: recorded actual outbound ringing/pairing and failed source awareness; distinguished the deployed correction/37 isolated passes from its pending real retest; updated retry limits, verified receipt/watch/audio-preview evidence, current pitch duration and unfinished replacement-video status.

- October 31, 3:36 p.m.: selected the source-backed 2024 Chinatown opening; preserved previous scripts/audio and marked new narration timing pending.

- October 31, 3:41 p.m.: selected real-story voice passed under 60 seconds; updated 117.77-second video passed media QA; recorded the later 106-second outbound reply-path failure and local 38-check correction without promoting it to carrier success. Public source published and anonymously verified.

- October 31, 3:46 p.m.: final real 84-second English outbound retest confirmed responsive and agenda-aware; no brief review/send in that retest, so spoken receipt remains implementation/test evidence. Hosted final 117.77-second media verified; manual YouTube URL pending.
