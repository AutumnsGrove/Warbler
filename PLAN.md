# Warbler: Self-Hosted Voice Training PWA

A personal, private voice training tool: live pitch and resonance feedback, a daily lesson flow, weekly progress checks, and full session history. Runs on "the potato" (Le Potato SBC, arm64), served over Tailscale, used from a phone as an installed PWA.

This file is the source of truth for the build. An agent should read it fully, then work **one phase at a time** (see [Working agreement](#working-agreement)).

## Table of contents

1. [Goals and non-goals](#goals-and-non-goals)
2. [Decisions already made](#decisions-already-made)
3. [Architecture](#architecture)
4. [Repo layout](#repo-layout)
5. [Safety rules (non-negotiable)](#safety-rules-non-negotiable)
6. [DSP specification](#dsp-specification)
7. [Data model and API](#data-model-and-api)
8. [Lessons and weekly coach](#lessons-and-weekly-coach)
9. [Phases](#phases)
10. [Dev, test, deploy](#dev-test-deploy)
11. [Working agreement](#working-agreement)
12. [References](#references)

---

## Goals and non-goals

**Goals**

- Live feedback on pitch (F0), resonance (F1–F3 on a vowel chart), and, later, an experimental "weight" measure.
- A short daily lesson: warm up, learn one thing, practise it with live feedback, done (~10 min).
- A weekly check: read the same passage every week, compare against all previous weeks, get a plain-language report and a rule-based plan for next week.
- Keep **everything**: raw audio and derived numbers for every session, replayable and re-analysable later.
- Fully private. No third parties, no telemetry, no accounts.

**Non-goals (v1)**

- Native iOS/Android apps (this is a PWA).
- Cloud hosting, public exposure, Tailscale Funnel, multi-user support, auth.
- LLM calls of any kind. The weekly plan is rule-based.
- Offline use. The app is **online-only** (needs Tailscale connected).
- Medical claims. This is a practice aid, not therapy.

## Decisions already made

| Topic | Decision |
|---|---|
| Delivery | PWA installed to iOS home screen |
| Hosting | The potato, in Docker (matching her other services), via `tailscale serve` (tailnet-only HTTPS) |
| Backend | Go, single static binary, SQLite (`modernc.org/sqlite`, pure Go) |
| Frontend | SvelteKit + TypeScript, `adapter-static`, SPA mode |
| DSP | In the browser (AudioWorklet + Web Worker). The server never analyses audio in v1 |
| Connectivity | Online-only. No offline caching of data; only a tiny retry buffer for an unsent session (see Phase 5) |
| Scope | Everything in v1, including daily lessons |
| Audio retention | Keep all audio for every session (disk is plentiful: 256 GB) |
| Auth | None. The container port is published to `127.0.0.1` on the potato only; `tailscale serve` is the sole way in |
| Targets | User-configurable. The app ships **no default target** and assumes no direction |

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
 └──────────────────────┬────────────────────────────────┘
                        │ HTTPS via tailscale serve
 THE POTATO             ▼
 ┌───────────────────────────────────────────────────────┐
 │ Go (127.0.0.1:PORT)                                   │
 │   embed.FS static build + /api/*                      │
 │   SQLite (metadata, summaries, progress)              │
 │   data/audio/*.wav  data/series/*.bin.gz              │
 └───────────────────────────────────────────────────────┘
```

Key points:

- **Live DSP is client-side**, because latency matters and the potato is small.
- **Secure context is required for the mic.** `getUserMedia` only works over HTTPS, so every environment (dev and prod) is reached through `tailscale serve`.
- **Audio thread stays light.** The worklet only decimates, runs pitch detection and RMS, and forwards PCM. Formant analysis runs in a separate Web Worker.

## Repo layout

```
warbler/
├── PLAN.md
├── AGENTS.md                # short rules, copied from "Working agreement"
├── Makefile                 # dev, build, build-arm64, deploy, test
├── web/                     # SvelteKit app
│   ├── src/lib/dsp/         # pure TS DSP (unit-tested, no DOM)
│   ├── src/lib/audio/       # mic + worklet + recorder glue
│   ├── src/lib/stores/
│   ├── src/lib/viz/         # canvas renderers
│   ├── src/routes/
│   ├── static/pitch-worklet.js
│   └── content/             # lessons + passages (markdown + frontmatter)
├── server/                  # Go
│   ├── cmd/warbler/main.go
│   ├── internal/{api,db,store}/
│   └── migrations/
├── tools/validate/          # Python (uv): synthetic vowels + parselmouth comparison
└── deploy/                  # Dockerfile, compose file, tailscale serve notes
```

## Safety rules (non-negotiable)

These are product requirements, not polish. Voice training can injure a voice when pushed.

1. **Never score against 100% of a target.** All targets use a **ramp**: the user sets "percent of the way from my starting zone to my target zone", and the UI shows that intermediate zone. Default ramp is conservative and can only be raised by the user.
2. **Session cap.** Default 30 minutes per session. Break prompt roughly every 10 minutes. Both configurable.
3. **Stop screen.** Every practice start screen states: stop if you feel pain, strain, tightness, or hoarseness; rest and hydrate. Suggest seeing a speech-language pathologist (ideally one experienced in gender-affirming voice work) for persistent problems.
4. **Tone of feedback.** No failure states, no red/shame colours for "off target". Neutral descriptions ("median pitch 14 Hz below your current zone"). Streaks are optional and off by default.
5. **Numbers are estimates.** Label pitch, formants, and weight as approximate measurements, not diagnoses or "pass/fail" verdicts.
6. **No medical claims** in any copy, including lessons.

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
- YIN with absolute threshold ~0.15, parabolic interpolation, search range configurable (default 70–500 Hz).
- Hop ≈ 10–20 ms, window ≈ 40–50 ms.
- Silence gate on RMS. **Drop frames below a clarity threshold**; never plot low-confidence values.
- 3–5 frame median smoothing for display. Store raw per-frame values too.
- Display in Hz, with optional semitone/note readout.

### Formants (F1–F3)

- Runs in a Web Worker fed PCM chunks from the worklet.
- Pre-emphasis, resample to about 2 × formant ceiling, ~25 ms Gaussian/Hann window, **Burg LPC** (to match Praat for validation), root-solve for formant candidates, filter by bandwidth.
- **Formant ceiling is a user setting** (typical starting points: 5000–5500 Hz; expose it in settings with a short tooltip). LPC order derives from the ceiling.
- Only analyse **voiced** frames (use the F0 clarity result).
- Vowel chart: F1 vs F2 density plot of recent frames, plus per-session medians. Show the user's configured zones as overlays.

### Weight (experimental, last phase)

- Candidate measures: spectral tilt / H1–H2 style measures, cepstral peak prominence. Pick one, validate it, document it.
- Must be labelled **"experimental"** in the UI until validated against parselmouth on real recordings.

### Validation (required before Phase 4 is done)

`tools/validate/` (Python, uv):

1. **Synthetic ground truth.** Generate source-filter vowels with known F0 and F1–F3; assert TS output is within tolerance (start at ±3% F0, ±8% formants; tighten if easy).
2. **Reference comparison.** On real recordings (the user's own, never committed to git), compare TS output against `parselmouth` (Praat) and report the error distribution. The agent writes the harness; the human supplies recordings.

Do not mark formants done until this passes. A vowel chart that looks plausible but is wrong is worse than none.

## Data model and API

Everything is keyed by **client-generated UUIDs** so retries are idempotent.

### SQLite tables

| Table | Key columns |
|---|---|
| `sessions` | `id` (uuid), `started_at`, `ended_at`, `kind` (`practice` / `lesson` / `weekly_passage` / `free`), `lesson_id?`, `passage_id?`, `duration_s`, `sample_rate`, `audio_path`, `series_path`, `settings_snapshot` (json), `summary` (json) |
| `lesson_progress` | `lesson_id`, `completed_at`, `session_id?` |
| `weekly_reports` | `week_start`, `session_id`, `stats` (json), `plan` (json) |
| `settings` | single row, json (targets, ramp, ceiling, caps, f0 search range) |

`summary` holds median/p10/p90 F0, median F1–F3, voiced fraction, and similar. The per-frame series (f0, clarity, rms, F1–F3 at ~20 ms) is stored as a gzipped binary blob under `data/series/`. It is re-derivable from the audio, but it makes charts fast.

### Audio

- Record PCM from the worklet as Int16 chunks in memory, encode **WAV mono 16-bit** at the capture-after-decimation rate (target 16 kHz; keep it a single constant so it can be raised later). A 30-minute session is about 58 MB, so memory and disk are both fine.
- The session cap bounds memory use.
- Server stores `data/audio/{uuid}.wav`.

### Endpoints

```
GET    /api/health
GET    /api/settings            PUT /api/settings
POST   /api/sessions            multipart: meta.json + series.bin.gz + audio.wav (idempotent on id)
GET    /api/sessions?from=&to=&kind=
GET    /api/sessions/:id
GET    /api/sessions/:id/audio  (must support HTTP Range for seeking)
GET    /api/sessions/:id/series
DELETE /api/sessions/:id
GET    /api/progress?weeks=N    aggregated weekly stats for charts
GET    /api/lessons             list + progress
POST   /api/lessons/:id/complete
GET    /api/weekly/current      this week's report/plan (computes if absent)
GET    /api/export              zip of db + audio + series
```

Server rules: publish the port on `127.0.0.1` only (Docker `-p 127.0.0.1:PORT:8080`); cap request body size sensibly (sessions up to ~100 MB); validate WAV headers; never trust client paths.

## Lessons and weekly coach

### Lesson files

`web/content/lessons/NN-slug.md` with frontmatter:

```yaml
---
id: pitch-01-finding-your-range
topic: pitch        # health | pitch | resonance | quality | prosody | articulation | transfer
order: 10
minutes: 10
status: draft       # draft | reviewed
sources: [ "https://..." ]
steps:
  - type: warmup    # warmup | learn | practice | done
---
```

Each lesson follows the flow **warm-up → one concept → guided practice with live feedback → done**. A build script compiles markdown to JSON consumed by the app.

### Authoring rules for the agent

- Draft lessons only from the cited public sources in [References](#references) and similar open material. **Do not invent clinical protocols or claims.**
- Every lesson carries `sources` and starts as `status: draft`. The UI shows a subtle "draft, unreviewed" marker. A human (or an SLP, if the user chooses to book a session) promotes lessons to `reviewed`.
- Topic arc for the seed curriculum: vocal health and warm-ups, pitch, resonance, vocal quality, intonation/prosody, articulation, carry-over to everyday speech.
- Include the stop-if-strained guidance in every practice step.
- Seed with a modest set (roughly 14–20 lessons) and 2–3 weekly reading passages. More can be added later as pure content.

### Weekly passage and coach (rule-based)

1. Each week the user records the same passage (`kind=weekly_passage`).
2. The server (or client) computes stats and compares to all prior weeks.
3. The report is plain language with a "listen to week 1 vs now" player.
4. The plan picks next week's focus lessons by simple rules (for example, F0 median below the ramped zone → pitch lessons; F2 below zone → resonance lessons; stable and in-zone → prosody/transfer). Rules live in one readable file and are unit-tested.

## Phases

Each phase ends with **Done when** criteria. Items marked **[HUMAN]** need Autumn; the agent must stop and ask, not guess.

### Phase 0: Hello mic (gate)

- Scaffold repo, Makefile, SvelteKit (static/SPA), Go server embedding the build.
- `tailscale serve` to the Go binary on the potato and to the Vite dev server for phone testing. Check `tailscale serve --help` on the installed version; flags have changed across releases. Pick a port/path that does not collide with her other served projects.
- Minimal page: tap to start, live RMS meter.
- PWA manifest and icons so it installs to the home screen.

**Done when:** [HUMAN] installs it on her phone, taps, grants mic, sees the meter move, closes and reopens the installed app, and reports whether mic permission re-prompts. Record the result in `NOTES.md`.

### Phase 1: Live pitch

- Worklet: decimate + YIN + RMS; frames to main thread.
- Scrolling pitch trace on canvas with target/ramp band overlay, Hz and note readout.
- Settings screen: f0 search range, ramp %, start zone, target zone, session cap. **No default zones**; first run requires the user to set them (or choose "just show me my voice").
- Safety rules 1–5 implemented (stop screen, caps, break prompt).

**Done when:** pitch trace is stable on real speech with no obvious octave jumps; unit tests for YIN pass on synthetic tones and noisy tones; CPU use is reasonable on the phone (no heat or visible lag over 10 minutes).

### Phase 2: Sessions and storage

- Session recorder: PCM to WAV in memory, series to binary blob, summary stats.
- Go API: sessions, settings, audio with Range support, series, delete. SQLite migrations.
- History page: list, open a session, replay audio with the pitch trace synced to playback.

**Done when:** a session survives app restart, replays correctly, and is deletable; `go test` covers idempotent POST and WAV validation.

### Phase 3: Progress charts

- Weekly aggregates endpoint; charts for median F0 and spread over time.
- Export endpoint (zip).

**Done when:** charts reflect real stored sessions; export produces a valid zip.

### Phase 4: Formants and vowel chart

- Analysis worker with Burg LPC pipeline; vowel chart with zone overlays; ceiling setting.
- Build `tools/validate/` (synthetic + parselmouth comparison).

**Done when:** validation passes at the stated tolerances; **[HUMAN]** supplies a few recordings for the parselmouth comparison and confirms the chart looks sane for her own vowels.

### Phase 5: Weekly passage and plan

- Passage reader screen; weekly session kind; comparison report; rule-based plan; "week 1 vs now" player.
- Retry buffer: if the upload at end of session fails (Tailscale dropped), keep the finished session in memory/IndexedDB and retry with backoff. Show an unmistakable "not saved yet" state. This is a safety net, **not** an offline mode.

**Done when:** after three weekly recordings the report renders; a simulated upload failure retries and eventually saves without duplicating.

### Phase 6: Daily lessons

- Lesson compiler, lesson runner UI (steps, timer, embedded live feedback), progress tracking, today's-lesson picker driven by the weekly plan.
- Seed content per the authoring rules; all `status: draft`.

**Done when:** a full lesson can be run end to end and recorded as a `kind=lesson` session; lesson progress persists.

### Phase 7: Experimental weight measure

- Implement one measure, validate against parselmouth, ship behind an "experimental" label.

**Done when:** documented definition, validation results in `NOTES.md`, UI label in place. If validation fails, ship nothing and document why.

### Phase 8: Hardening

- Backup story for `data/` (nightly copy to somewhere other than the potato's own SD/eMMC; ask the user where).
- Docker restart policy (`unless-stopped`), log rotation, disk-space check in `/api/health`.
- Accessibility pass: contrast, tap targets, reduced motion.
- README with deploy and recovery steps.

**Done when:** reboot the potato and the app comes back; a restore from backup is tested once.

## Dev, test, deploy

- `make dev`: Vite dev server and Go API with proxy; expose the dev port via `tailscale serve` for the phone.
- `make test`: vitest (DSP, rules), `go test ./...`, Python validation (opt-in, needs recordings).
- `make build-arm64`: `GOOS=linux GOARCH=arm64 CGO_ENABLED=0`; embed the web build.
- `make deploy`: build an arm64 Docker image, copy it to the potato, restart the container. Her other services on the potato run in Docker, so Warbler matches that; do not introduce a new pattern.
- Never commit recordings, `data/`, or personal settings.

## Working agreement

Copy this section into `AGENTS.md`.

1. Work **one phase at a time**. Commit per phase with a clear message. Do not start the next phase until "Done when" is satisfied.
2. Stop and ask at every **[HUMAN]** item. Do not fake phone-test results.
3. Keep scope tight. Do not add features, dependencies, or services that are not in this plan without asking.
4. Prefer small, readable functions and a functional core with thin imperative edges. DSP stays pure and tested.
5. No telemetry, no external network calls at runtime, no third-party scripts.
6. Do not invent clinical content. Lessons cite sources and ship as `draft`.
7. Safety rules are requirements. If a task conflicts with them, flag it instead of working around it.
8. When something is uncertain (iOS behaviour, LPC accuracy, library license), write findings in `NOTES.md` and surface them.

## References

Seed sources for lesson authoring and design. Verify licences before reusing any code.

- Effects of speech therapy for transgender women: systematic review: https://pmc.ncbi.nlm.nih.gov/articles/PMC10553375
- Speech therapy for transgender women: updated systematic review and meta-analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC10363306
- The role of voice therapy and phonosurgery in transgender vocal feminization (J Craniofac Surg 2019): https://pubmed.ncbi.nlm.nih.gov/31299724/
- Voice parameters that result in identification or misidentification of gender in MtF transgender veterans: https://dc.etsu.edu/etsu-works/16231
- TruVox, web-based pitch training for transgender women (JMIR Formative Research 2025): https://formative.jmir.org/2025/1/e73841
- Braat, open-source in-browser pitch/formant tool (TypeScript; DSP ported from Praat, so check licence before reuse): https://codeberg.org/jocelyn-stericker/braat
- audirs, Rust voice trainer with target-zone ramping: https://github.com/hiibolt/audirs
- Voice Trainer, open-source desktop app with pitch/formant tracking and history: https://codeberg.org/afritsch/voice-trainer
- Praat / parselmouth for validation reference values.
