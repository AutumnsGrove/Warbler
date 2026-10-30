# Warbler: Self-Hosted Voice Training PWA

A personal, private voice training tool: live pitch and resonance feedback, a daily lesson flow, weekly progress checks, practice phone calls, and full session history. Runs on "the potato" (Le Potato SBC, arm64) in Docker, served over Tailscale, used from a phone as an installed PWA.

This file is the source of truth for the build. An agent should read it fully, then work **one phase at a time** (see [Working agreement](#working-agreement)). Detailed designs live in `docs/` and are listed below; read the one that matches the phase before starting it.

## Table of contents

1. [Design documents](#design-documents)
2. [Goals and non-goals](#goals-and-non-goals)
3. [Decisions already made](#decisions-already-made)
4. [Architecture](#architecture)
5. [Repo layout](#repo-layout)
6. [Safety rules (non-negotiable)](#safety-rules-non-negotiable)
7. [DSP specification](#dsp-specification)
8. [Data model and API](#data-model-and-api)
9. [Lessons, coach and call simulator](#lessons-coach-and-call-simulator)
10. [Phases](#phases)
11. [Dev, test, deploy](#dev-test-deploy)
12. [Open items](#open-items)
13. [Working agreement](#working-agreement)
14. [References](#references)

---

## Design documents

| File | What it covers | Read before |
|---|---|---|
| `docs/phase-0.md` | Step-by-step plan and phone test for the first gate | Phase 0 |
| `docs/update.md` | In-app updates: Settings button, Meridian tap, host watcher, rollback | Phase 0 |
| `docs/screens.md` | Every screen as a sketch, design rules, note-name explainer | Any UI work |
| `docs/data-api.md` | Database tables, file formats, every endpoint, upload safety, security, settings fields | Phases 2, 3, 5 |
| `docs/testing.md` | Test strategy, accuracy thresholds, recording protocol, safety-rule tests, CI | Phases 1, 4 and any DSP change |
| `docs/coach.md` | Weekly report and rule-based plan | Phase 5 |
| `docs/lessons.md` | Lesson research, writing style, curriculum of 30, features the lessons need, source notes | Phase 6 |
| `docs/passages.md` | Weekly reading passage (frozen once recorded) and optional extras | Phase 5 |
| `docs/call-simulator.md` | Practice phone calls: authoring tool, playback, cost controls | Phase 6b |
| `web/content/lessons/` | The 30 drafted lessons (all `status: draft`) | Phase 6 |

If a design document and this file disagree, stop and ask Autumn which is right, then fix both.

## Goals and non-goals

**Goals**

- Live feedback on pitch (F0), resonance (F1-F3 on a vowel chart), and, later, an experimental "weight" measure.
- A short daily lesson: warm up, learn one thing, practise it with live feedback, done (6 to 8 minutes).
- A weekly check: read the same passage every week, compare against all previous weeks, get a plain-language report and a rule-based plan for next week.
- Practice phone calls with pre-recorded, lifelike callers, so practice feels like the real world.
- Keep **everything**: raw audio and derived numbers for every session, replayable and re-analysable later.
- Fully private. No third parties at runtime, no telemetry, no accounts.

**Non-goals (v1)**

- Native iOS/Android apps (this is a PWA).
- Cloud hosting, public exposure, Tailscale Funnel, multi-user support, passwords.
- LLM or other outside-service calls **at runtime** (in the app or on the potato). The weekly plan is rule-based. The one exception is the Mac-only authoring tool for the call simulator (see `docs/call-simulator.md`), which runs by hand, is never deployed, and only voices scripts already approved. The other exception is the host-side update watcher (`docs/update.md`), which fetches a new Warbler image from GitHub only when you or Meridian ask for an update. The app container itself never goes online.
- Offline use. The app is **online-only** (needs Tailscale connected).
- Medical claims. This is a practice aid, not therapy.

## Decisions already made

| Topic | Decision |
|---|---|
| Delivery | PWA installed to iOS home screen |
| Hosting | The potato, in Docker (matching Polaris: image from GHCR, pinned by digest, systemd update watcher), via `tailscale serve` (tailnet-only HTTPS). Port 8892 proposed, folder `~/Warbler` |
| Updates | In-app Settings button, Meridian tap and manual command all run one host-side watcher with health check and rollback. The app never contacts GHCR itself. Full design in `docs/update.md` |
| Backend | Go, single static binary, SQLite (`modernc.org/sqlite`, pure Go) |
| Frontend | SvelteKit + TypeScript, `adapter-static`, SPA mode |
| DSP | In the browser (AudioWorklet + Web Worker). The server never analyses audio in v1 |
| Coach | TypeScript in the web app, rule-based, one readable rules file. The server only stores finished reports |
| Connectivity | Online-only. No offline caching of data; only a retry buffer for an unsent session (Phase 5) |
| Hub | Meridian (Autumn's app hub) probes `GET /healthz` and starts `warbler-update.service`. Warbler adds nothing to Meridian beyond three config snippets |
| Scope | Everything in v1: lessons, weekly coach, call simulator |
| Audio retention | Keep all audio for every session (disk is plentiful: 256 GB) |
| Deleting | Deleted sessions sit in "Recently deleted" for 14 days, then are removed for good ("Empty now" available) |
| Auth | No passwords. The container port is published to `127.0.0.1` on the potato only; `tailscale serve` is the sole way in. The server also requires the Tailscale identity header |
| Approved dependencies | Beyond the stack above: `@fontsource/lexend` (bundled font) and `@lucide/svelte` icons (the maintained successor of `lucide-svelte`, same icon set). Build-only: `cookie`, pinned because SvelteKit's build step needs it under pnpm. Anything else needs asking |
| Services | GitHub (repo, public) and GitHub Actions (tests on every push; no secrets, no recordings). The call-simulator speech service is Mac-only. Any other new service needs asking |
| Look and feel | Warm, subtle bird theme. Font: Lexend (bundled). Icons: Lucide. **No emojis anywhere** (UI, docs, lessons, commit messages) |
| Pitch display | Hz plus nearest note name, always shown together |
| Targets | User-configurable. The app ships **no default target** and assumes no direction. Default ramp suggestion is 25% |
| Session feel tags | After each session, optional tap-to-select chips (voice feel and daily context). Fixed list in v1, no free text |
| Week | Starts on Sunday (setting). Weeks follow the phone's local date |
| Lessons | 30 lessons, all drafted before building starts, reviewed by Autumn batch by batch. Direction-neutral wording, active practice steps, safety shown by one fixed banner |
| Weekly passage | "The morning market" (Option A in `docs/passages.md`). Frozen once the first real recording is made |
| Accuracy | Pitch within 3%, formants within 8%, median difference against Praat under 5%; low-confidence readings are hidden, not shown. Thresholds are starting points |
| Recording session | One 20-minute session of Autumn's own voice, done once before Phase 1 validation and reused in Phase 4. Stays in `local-recordings/`, never committed |
| Licence | MIT, same as Polaris and Meridian (`LICENSE`) |
| Language | Explain terms in plain language in every doc and in the app. Autumn is new to the technical vocabulary |

## Architecture

```
 PHONE (installed PWA, Tailscale on)
 ┌───────────────────────────────────────────────────────┐
 │ mic ─► AudioWorklet (decimate, YIN, RMS)              │
 │          │ f0/clarity/rms + PCM chunks (Int16)        │
 │          ▼                                            │
 │   Analysis Worker (Burg LPC formants, [later] weight) │
 │          ▼                                            │
 │   Svelte stores ─► canvas (pitch trace, vowel chart)  │
 │   Session recorder (PCM → WAV, series → binary blob)  │
 │   Coach (TypeScript rules) · Lesson runner · Calls    │
 │   Upload queue (IndexedDB) with retry                 │
 └──────────────────────┬────────────────────────────────┘
                        │ HTTPS via tailscale serve
 THE POTATO (Docker)    ▼
 ┌───────────────────────────────────────────────────────┐
 │ Go (127.0.0.1:PORT)                                   │
 │   embed.FS static build + /api/*                      │
 │   SQLite (records, summaries, reports)                │
 │   data/audio/*.wav  data/series/*.wbs.gz              │
 │   data/scenarios/  (pre-recorded call audio)          │
 └───────────────────────────────────────────────────────┘

 HOST WATCHER (systemd, on the potato, outside Docker)
   warbler-update.path ─► update.sh ─► GHCR (only when asked) ─► pull, recreate, health check, rollback

 MAC ONLY (never deployed)
   tools/callsim  ─► speech service ─► call audio ─► copied to the potato at deploy
```

Key points:

- **Live DSP is client-side**, because latency matters and the potato is small.
- **Secure context is required for the mic.** `getUserMedia` only works over HTTPS, so every environment (dev and prod) is reached through `tailscale serve`.
- **Audio thread stays light.** The worklet only decimates, runs pitch detection and RMS, and forwards PCM. Formant analysis runs in a separate Web Worker.
- **One code path.** The live worklet is a thin wrapper around the same pure functions the tests call.

## Repo layout

```
warbler/
├── PLAN.md
├── AGENTS.md                # short rules, copied from "Working agreement"
├── NOTES.md                 # findings, phone-test results, validation results
├── Makefile                 # dev, build, build-arm64, deploy, test, test-validate, test-real
├── docs/                    # design documents (see above)
├── .github/workflows/       # tests on every push; publish multi-arch image to GHCR from main
├── web/                     # SvelteKit app
│   ├── src/lib/dsp/         # pure TS DSP (unit-tested, no DOM)
│   ├── src/lib/coach/       # rules.ts, constants.ts, report wording (pure, unit-tested)
│   ├── src/lib/measures/    # pure measures over frames: start-to-end change, pause count, pitch range used, onset rise time
│   ├── src/lib/audio/       # mic + worklet + recorder + instant replay buffer
│   ├── src/lib/upload/      # IndexedDB queue and retry
│   ├── src/lib/stores/
│   ├── src/lib/viz/         # canvas renderers
│   ├── src/routes/
│   ├── static/pitch-worklet.js
│   └── content/             # lessons/ (30 drafted) and passages
├── server/                  # Go
│   ├── cmd/warbler/main.go  # includes the `verify` command
│   ├── internal/{api,db,store}/
│   └── migrations/
├── tools/validate/          # Python (uv): synthetic voices + parselmouth comparison
├── tools/callsim/           # Python (uv), Mac only: draft, voice, preview, bundle call audio
├── local-recordings/        # Autumn's own recordings. In .gitignore. Never committed
├── Dockerfile
├── docker-compose.yml       # at the root, like Polaris, so Meridian's compose actions find it
├── scripts/                 # repo helper scripts (no-outside-addresses check)
└── deploy/                  # install.sh, watcher/ (update.sh, systemd units, tests), meridian/ (config snippets)
```

## Safety rules (non-negotiable)

These are product requirements, not polish. Voice training can injure a voice when pushed. Each rule has an automated test (see `docs/testing.md`, Layer 10).

1. **Never score against 100% of a target.** All targets use a **ramp**: the user sets "percent of the way from my starting zone to my target zone", and the UI shows that intermediate zone. Default suggestion 25%. Only the user can raise it. The coach may offer to lower it, never raise it.
2. **Session cap.** Default 30 minutes per session. Break prompt roughly every 10 minutes. Both configurable. The cap cannot be raised from the practice screen.
3. **Stop screen and banner.** Every practice start passes through a stop screen: stop if you feel pain, strain, tightness, or hoarseness; rest and hydrate; a speech-language pathologist (ideally one experienced in gender-affirming voice work) can help with persistent problems. During practice and lesson steps, one small fixed banner repeats the short form ("Stop if anything hurts or strains"). Lesson text does not repeat it.
4. **Tone of feedback.** No failure states, no red/shame colours for "off target". Neutral descriptions ("median pitch 14 Hz below your current zone"). Streaks are optional and off by default. The coach never uses words like "failed", "behind", "best", "worst", "too low", "too high".
5. **Tight or scratchy feedback.** If the user tags a session as Tight or Scratchy, show one calm line suggesting rest (and a doctor if it persists). No alarm styling. Two such weeks in a row also trigger the coach's rest plan (`docs/coach.md`, group A).
6. **Numbers are estimates.** Label pitch, formants, and weight as approximate measurements, not diagnoses or "pass/fail" verdicts. When confidence is low, show nothing instead of a doubtful number.
7. **No medical claims** in any copy, including lessons.

## DSP specification

All DSP lives in `web/src/lib/dsp/` as pure, DOM-free TypeScript so it can be unit-tested with vitest.

### Capture

```ts
getUserMedia({ audio: {
  echoCancellation: false, noiseSuppression: false,
  autoGainControl: false, channelCount: 1 }})
```

- Create/resume `AudioContext` **inside a tap handler** (iOS requirement).
- **Never hardcode the sample rate.** Read `audioContext.sampleRate` (typically 44.1 or 48 kHz).
- Acquire a Screen Wake Lock during sessions; release on end.
- Handle audio interruptions (phone call, tab hidden): pause the session and surface a clear "paused" state.

### Pitch (F0)

- **Low-pass + decimate** to about 12 kHz (or the nearest integer factor of the native rate) before analysis. Do **not** run YIN at full rate in the audio thread; it is too expensive for a phone.
- YIN with absolute threshold ~0.15, parabolic interpolation, search range configurable (default 70-500 Hz).
- Hop ≈ 10-20 ms, window ≈ 40-50 ms.
- Silence gate on RMS. **Drop frames below a clarity threshold**; never plot low-confidence values.
- 3-5 frame median smoothing for display. Store raw per-frame values too.
- Display in Hz with the nearest note name, always together.

### Formants (F1-F3)

- Runs in a Web Worker fed PCM chunks from the worklet.
- Pre-emphasis, resample to about 2 × formant ceiling, ~25 ms Gaussian/Hann window, **Burg LPC** (to match Praat for validation), root-solve for formant candidates, filter by bandwidth.
- **Formant ceiling is a user setting** (typical starting points: 5000-5500 Hz; expose it in settings with a short tooltip). LPC order derives from the ceiling.
- Only analyse **voiced** frames (use the F0 clarity result).
- Output a confidence flag per frame; low-confidence frames show nothing.
- Vowel chart: F1 vs F2 density plot of recent frames, plus per-session medians. Show the user's configured zones as overlays.

### Weight (experimental, last phase)

- Candidate measures: spectral tilt / H1-H2 style measures, cepstral peak prominence. Pick one, validate it, document it.
- Must be labelled **"experimental"** in the UI until validated against parselmouth on real recordings.

### Validation

The full strategy, thresholds, voice grid and recording protocol are in `docs/testing.md`. In short:

- `tools/validate/` (Python, uv) builds synthetic voices with known answers, written separately from the TypeScript code so one bug cannot hide in both.
- Pitch is validated in Phase 1. Formants are validated in Phase 4.
- Real recordings (Autumn's, never committed) are compared against `parselmouth` (Praat) with identical settings.

Do not mark pitch or formants done until their checks pass. A chart that looks plausible but is wrong is worse than none.

## Data model and API

The full design (tables, file formats, every endpoint, upload safety, security, settings fields) is in `docs/data-api.md`. Summary:

- Everything is keyed by **client-generated UUIDs** so retries are idempotent.
- Times are stored as UTC plus the phone's offset and local date, so weeks follow Autumn's calendar.
- **Tables:** `sessions` (with `kind` of `practice`, `lesson`, `weekly_passage`, `free`, `call_sim`; fingerprints for files; `settings_snapshot`; `summary`; `analysis_version`; `deleted_at`), `session_tags`, `lesson_completions` (a log, since lessons can be repeated), `weekly_reports` (recomputations add rows and link old ones), `settings` (one row with a version number), `schema_migrations`.
- **Files:** `data/audio/{id}.wav` (WAV mono 16-bit, 16 kHz, one constant), `data/series/{id}.wbs.gz` (compact per-frame record, versioned format), `data/scenarios/` (call audio).
- **Upload:** the phone saves a pending copy first, uploads, and deletes the copy only after the server confirms matching fingerprints. The server writes files first, then the database record, and sweeps strays at start-up.
- **Endpoints** (see `docs/data-api.md` for the full list): `/healthz` (unlocked, version only), health, version and update (see `docs/update.md`), settings, sessions (create, list, get, edit tags, delete, restore), session audio (with Range) and series, analysis replacement for re-analysis, progress, lessons, weekly reports, scenarios, export, import.
- **Server rules:** require the Tailscale identity header (except `/healthz` and `/api/busy`, which are called on the potato itself and return nothing personal); allow only the app's own Host names; no CORS; strict content policy (own files only); body size limit about 100 MB; validate WAV headers; never trust client paths; publish the container port on `127.0.0.1` only; minimal logs with no personal data.

## Lessons, coach and call simulator

### Lessons

- 30 lessons are drafted in `web/content/lessons/`, each with `status: draft`. The curriculum, research, writing style and source notes are in `docs/lessons.md`.
- Frontmatter has: `id`, `title`, `topic`, `order`, `minutes`, `status`, `needs_phase`, `prereq`, `revisit`, `live_feedback`, optional `optional` and `evidence`, `sources` (with `id`, `url`, `tier`, `used_for`) and `steps`. The build script compiles lessons to JSON and fails if a lesson breaks the rules in `docs/lessons.md`, section 4.
- Each lesson follows **warm-up, one concept, guided practice with live feedback, done**. Practice steps are active tasks, not "notice how you feel". Timers come from `(30s)` markers.
- A lesson is hidden until the app phase it needs (`needs_phase`) exists.
- The UI shows a subtle "draft, unreviewed" marker, and a small note on lessons marked `evidence: thin`.
- Authoring rules: do not invent clinical protocols or claims; every factual statement traces to a source in the lesson; leaflets written for patients are adapted gently in our own words; direction-neutral wording; no emojis. A human promotes lessons to `reviewed`.
- Several citations were read only at abstract or search-summary level. They are listed in `docs/lessons.md` and need a full read or textbook check before any lesson leaves draft.

### Weekly passage and coach (rule-based)

Full design in `docs/coach.md`. The coach is TypeScript in the web app (`web/src/lib/coach/`).

1. Each week the user records the same passage (`kind=weekly_passage`). The recording must pass quality checks (enough speech, not too quiet, not clipped, not too noisy) or the app explains why and offers a retry.
2. The phone computes stats and compares to earlier weeks, using changes beyond a "noise band" only. Smaller changes are "about the same".
3. The report is plain language, with a "listen to week 1, last week, or any chosen week versus now" player and a "How this was chosen" note.
4. The plan picks up to two focus areas and five lessons by rules in a fixed order: rest and safety first, then goal rules (only if a target is set), then variety, with special handling for the first weeks. About 4 lesson days a week is suggested, fewer is fine, and the coach never suggests more than the user's own session cap.
5. Rules live in one readable file and are unit-tested, including checks that safety wins and wording stays neutral.

### Call simulator

Full design in `docs/call-simulator.md`. Pre-recorded phone calls with lifelike voices, authored once on the Mac and played back from the potato. No outside calls at runtime. Open checks (speech provider via OpenRouter or ElevenLabs directly, terms of use, cost) are resolved at the start of Phase 6b.

## Phases

Each phase ends with **Done when** criteria. Items marked **[HUMAN]** need Autumn; the agent must stop and ask, not guess. At the end of each phase, update `NOTES.md`, commit, and push.

### Phase 0: Hello mic and update path (gate)

Detailed task list and the phone test checklist are in `docs/phase-0.md`; the update design is in `docs/update.md`.

- Scaffold repo, Makefile, SvelteKit (static/SPA, pnpm), Go server embedding the build, `.gitignore` (including `local-recordings/`, `data/`), `AGENTS.md`, `NOTES.md`.
- Dockerfile and compose file matching Polaris (multi-stage, distroless final image of about 3.5 MB, non-root, read-only, health check, loopback port 8892, `restart: unless-stopped`, update-signal mount). **Built and smoke-tested locally.**
- GitHub Actions: tests on every push; build and publish a multi-arch image (`linux/amd64`, `linux/arm64`) to `ghcr.io/autumnsgrove/warbler` from `main`, with the `r<count>.<sha>` version stamped in.
- **In-app update mechanism** per `docs/update.md`: `/healthz`, `/api/version`, check/start/status endpoints, `/api/busy`, a Settings "About" section; `deploy/watcher/` (script, path/service/timer units, tests); `deploy/install.sh`; `deploy/meridian/` snippets.
- `tailscale serve` to the container on the potato and to the Vite dev server for phone testing. Check `tailscale serve --help` on the installed version.
- Confirm the Tailscale identity header actually arrives, and add the server check.
- Minimal page: tap to start, live RMS meter, shows the real sample rate and the version.
- PWA manifest and icons so it installs to the home screen. Bundle Lexend and Lucide.
- A check that the built app makes no requests to outside addresses.

**Done when:** [HUMAN] completes the phone checklist in `docs/phase-0.md` (mic permission behaviour, lock and app-switch behaviour, stored-data survival over a few days). The app runs from the Docker container on the potato, pulled from GHCR. An update from Settings works end to end, an update from Meridian works end to end, and a deliberately broken build rolls back. Results are in `NOTES.md`.

### Phase 1: Live pitch

- Worklet: decimate + YIN + RMS; frames to main thread. Chunk-equivalence tests.
- Scrolling pitch trace on canvas with target/ramp band overlay, Hz and note name readout.
- Reference tone player (a play button that sounds a target note).
- Settings screen: f0 search range, ramp %, start zone, target zone, session cap, break interval, note names on or off. **No default zones**; first run requires the user to set them (or choose "just show me my voice").
- Stop screen, fixed practice banner, session cap, break sheet, neutral tone, approximate labels (safety rules 1-4, 6, 7) with their tests.
- Hidden Self-test screen that feeds a generated tone through the real analysis path on the phone.
- `tools/validate/`: synthetic pitch voices and the Praat pitch comparison.
- **[HUMAN]** the 20-minute recording session, saved in `local-recordings/`.

**Done when:** pitch trace is stable on real speech with no octave jumps; the pitch thresholds in `docs/testing.md` pass on synthetic voices and against Praat on Autumn's recordings; the speed budget passes; CPU use is reasonable on the phone (no heat or visible lag over 10 minutes); the Self-test screen reads correctly on her phone.

### Phase 2: Sessions and storage

- Session recorder: PCM to WAV in memory, series to binary blob, summary stats.
- Go API per `docs/data-api.md`: sessions, settings, audio with Range support, series, delete with 14-day recovery, health. SQLite migrations with automatic pre-migration snapshot.
- Upload with checksums. `warbler verify` command.
- History page: list, filters, open a session, replay audio with the pitch trace synced to playback, Recently deleted.
- Post-session feel tags (tap-to-select chips), saved with the session, plus safety rule 5 (calm rest note on Tight or Scratchy).
- Instant replay of the last few seconds during practice (short rolling audio buffer).

**Done when:** a session survives app restart, replays correctly, and is deletable and restorable; `go test` covers idempotent POST, WAV validation, malformed uploads (fuzzed), path tricks, Range requests, and migrations; the "no outside requests" and safety tests are green.

### Phase 3: Progress charts

- Weekly aggregates endpoint (Sunday weeks by local date); charts for median F0 and spread over time.
- Export endpoint (zip with manifest and fingerprints) and import endpoint (restore from a zip).

**Done when:** charts reflect real stored sessions; export produces a valid zip; export, wipe a test server, import, and compare passes.

### Phase 4: Formants and vowel chart

- Analysis worker with Burg LPC pipeline and confidence flags; vowel chart with zone overlays and cloud overlay; formant ceiling setting with its tooltip.
- Formant side of `tools/validate/`: synthetic voice grid (pitch, vowel, vocal tract size, ceiling, noise, loudness) and Praat comparison with identical settings.
- Re-analysis flow ("Update older sessions") using stored audio.

**Done when:** the formant thresholds in `docs/testing.md` pass, with known weak regions documented and hidden by confidence gating; **[HUMAN]** confirms the chart looks sane for her own vowels using the recordings from Phase 1.

### Phase 5: Weekly passage and plan

- Passage reader screen; weekly session kind; recording quality checks; comparison report; rule-based plan per `docs/coach.md`; "listen to any week versus now" player.
- Retry buffer: if the upload at end of session fails (Tailscale dropped), keep the finished session in IndexedDB and retry with backoff. Show an unmistakable "not saved yet" state. This is a safety net, **not** an offline mode. Confirm whether iOS keeps that storage for an installed app (open item).

**Done when:** after three weekly recordings the report renders; coach fixtures pass, including safety precedence and the forbidden-words check; a simulated upload failure retries and eventually saves without duplicating.

### Phase 6: Daily lessons

- Lesson compiler (markdown to JSON, with the rule checks) and lesson runner UI: steps, timer, fixed safety banner, embedded live feedback.
- Exercise components used by the lessons: target line with band and staircase, round counter, stage labels, hidden target, volume envelope, sustained-sound timer, drag-to-rank cards, typed phrase input, extremes markers, cloud overlay, Quick reset button.
- Pure measures in `web/src/lib/measures/` (start-to-end change, pitch range used, pause count, onset rise time), each unit-tested.
- Settings additions: `explored_range`, `base_note_hz`, `anchor_phrases`, `situation_ranking`, lesson days per week.
- Lesson progress tracking and today's-lesson picker driven by the weekly plan.
- Lessons whose `needs_phase` is not yet built stay hidden.

**Done when:** every lesson that is unlocked runs end to end and is recorded as a `kind=lesson` session; lesson progress persists; the lesson compile checks pass for all 30; **[HUMAN]** reviews the lessons in the app and flags anything to change.

### Phase 6b: Call simulator

- Resolve the open checks in `docs/call-simulator.md` (provider, terms, cost) with Autumn first.
- Authoring tool `tools/callsim/` (Mac only, Python/uv): draft, voice, preview, bundle. Cache, dry run, spending cap.
- App: scenario picker, in-call screen, automatic turn-taking from voice activity with a Next button as backup, hang up anytime.
- `call_sim` sessions in History, replay with both sides.
- Unlocks lesson xfer-05.

**Done when:** one scenario can be authored, voiced, previewed and bundled; a full call runs from the installed app and is saved and replayed.

### Phase 7: Experimental weight measure

- Implement one measure, validate against parselmouth, ship behind an "experimental" label.

**Done when:** documented definition, validation results in `NOTES.md`, UI label in place. If validation fails, ship nothing and document why.

### Phase 8: Hardening

- Backup for `data/` (nightly safe snapshot to somewhere other than the potato's own storage; **[HUMAN]** says where).
- Docker restart policy (`unless-stopped`), log rotation, disk-space warning in `/api/health`, nightly purge of sessions deleted more than 14 days ago.
- Accessibility pass: contrast, tap targets, reduced motion. Automated scan on every screen.
- README with deploy and recovery steps.

**Done when:** reboot the potato and the app comes back; a restore from backup is tested once.

## Dev, test, deploy

- `make dev`: Vite dev server and Go API with proxy; expose the dev port via `tailscale serve` for the phone.
- `make test`: vitest (DSP, measures, coach, safety rules, copy checks, lesson checks), `go test ./...` with the race detector, accessibility and no-outside-requests scans, and the Python synthetic-voice validation. Runs locally and in GitHub Actions.
- `make test-validate`: the full synthetic grid and Praat comparison; writes numbers (not audio) to `docs/validation/`.
- `make test-real`: runs Autumn's private recordings through the harness. Local only.
- `make build-arm64`: `GOOS=linux GOARCH=arm64 CGO_ENABLED=0`; embed the web build.
- `make deploy`: build an arm64 Docker image, copy it to the potato with the call audio, restart the container. Her other services on the potato run in Docker, so Warbler matches that; do not introduce a new pattern.
- Never commit recordings, `data/`, `local-recordings/`, generated call audio, API keys, or personal settings.

## Open items

Things not yet decided or verified. Each is resolved at the phase shown.

| Item | Phase | Notes |
|---|---|---|
| Confirm port 8892 and folder `~/Warbler` are free on the potato (SSH from the Mac currently fails host-key verification, so the agent could not check) | 0 | **[HUMAN]** |
| Apply the three Meridian additions (or ask for a pull request) | 0 | **[HUMAN]** |
| Does the Tailscale identity header arrive with the installed version? | 0 | Needed for the server lock |
| Does mic permission re-prompt in the installed iPhone app? | 0 | The gate |
| Does iOS keep an installed app's stored data across days of non-use? | 0 and 5 | Decides how much to trust the retry buffer |
| 20-minute recording session | 1 | **[HUMAN]** |
| Do OpenRouter's ElevenLabs voices work as Autumn described (model name, how audio returns, price)? | 6b | Her report; not verified by the agent |
| Speech service terms for generated audio | 6b | Read before spending |
| Backup destination | 8 | **[HUMAN]** |
| Full reads or textbook checks for sources read only at abstract or summary level | before any lesson is marked `reviewed` | Listed in `docs/lessons.md` |
| Scenario list for the call simulator | 6b | Autumn chooses which to write first |
| Licence check before reusing any code from Braat, audirs or Voice Trainer | 1 or 4 | Only if reusing code |

## Working agreement

Copy this section into `AGENTS.md`.

1. Work **one phase at a time**. Read the matching `docs/` file first. Commit and push per phase with a clear message. Do not start the next phase until "Done when" is satisfied.
2. Stop and ask at every **[HUMAN]** item. Do not fake phone-test results.
3. Keep scope tight. Do not add features, dependencies, or services that are not in this plan without asking.
4. Prefer small, readable functions and a functional core with thin imperative edges. DSP and measures stay pure and tested.
5. No telemetry, no external network calls from the app at runtime, no third-party scripts, fonts or icons loaded from outside. The only allowed outside traffic on the potato is the update watcher fetching a Warbler image on request.
6. Do not invent clinical content. Lessons cite sources and ship as `draft`.
7. Safety rules are requirements. If a task conflicts with them, flag it instead of working around it.
8. When something is uncertain (iOS behaviour, LPC accuracy, library license), write findings in `NOTES.md` and surface them.
9. Write for a reader new to the technical vocabulary: explain terms in plain language in docs, comments that face the user, and the app. No emojis anywhere.
10. Autumn uses she/her pronouns.

## References

Sources used for the design and lessons, with how each was read and what is still unchecked, are listed in `docs/lessons.md` (section 5). Core design references:

- Effects of speech therapy for transgender women: systematic review: https://pmc.ncbi.nlm.nih.gov/articles/PMC10553375
- Speech therapy for transgender women: updated systematic review and meta-analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC10363306
- The role of voice therapy and phonosurgery in transgender vocal feminization (J Craniofac Surg 2019): https://pubmed.ncbi.nlm.nih.gov/31299724/
- Voice parameters that result in identification or misidentification of gender in MtF transgender veterans: https://dc.etsu.edu/etsu-works/16231
- TruVox, web-based pitch training for transgender women (JMIR Formative Research 2025): https://formative.jmir.org/2025/1/e73841
- Braat, open-source in-browser pitch/formant tool (TypeScript; DSP ported from Praat, so check licence before reuse): https://codeberg.org/jocelyn-stericker/braat
- audirs, Rust voice trainer with target-zone ramping: https://github.com/hiibolt/audirs
- Voice Trainer, open-source desktop app with pitch/formant tracking and history: https://codeberg.org/afritsch/voice-trainer
- NIDCD, taking care of your voice: https://www.nidcd.nih.gov/health/taking-care-your-voice
- Praat / parselmouth for validation reference values.
