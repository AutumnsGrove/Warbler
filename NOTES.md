# Notes

Findings, test results and open questions, in the order they are learned. Each entry has a date. Anything uncertain (phone behaviour, library licences, accuracy) goes here, then gets surfaced to Autumn.

## Phase 0

### Setup facts

- Port 8892 and folder `~/Warbler`: confirmed free on the potato on 2026-10-30. Ports already listening there: 22 53 80 443 5335 8080 8081 8418 8766 8888 8890 8891 8899 11434.
- `lucide-svelte` is deprecated by its author in favour of `@lucide/svelte` (same icon set, same repository). The project uses `@lucide/svelte`.
- The SvelteKit scaffold in use (SvelteKit 3, Vite 8) keeps the adapter in `vite.config.ts` rather than `svelte.config.js`, and uses `#lib` subpath imports which cannot resolve TypeScript files without extensions. The project uses plain relative imports.
- `cookie` is declared as a dev dependency of `web/` because SvelteKit's post-build step imports it, and with pnpm's strict layout a copy higher up the folder tree (found at `~/node_modules/cookie`, an old CommonJS version) was being picked up instead.
- The GHCR package became public on its own (it inherits the public repository's visibility), so no manual step was needed.
- GitHub Actions warns that `actions/checkout@v4` and friends run on Node 20 (deprecated). They still work. Bump to newer majors when convenient.
- Existing unit `her-go.service` on the potato has `StartLimitIntervalSec` under `[Service]` (it belongs under `[Unit]`), so systemd ignores it and says so whenever units are verified. Not Warbler's, harmless, left alone; worth fixing separately.
- Licence: MIT, chosen by Autumn on 2026-10-30 (`LICENSE`).
- SSH to the potato: the working aliases are `potato-remote` (over Tailscale) and `potato` (home network only). The agent's first attempt used the wrong name (`lepotato`), which is why it saw a host-key error. The potato has passwordless sudo, Docker 29.6 with Compose v5.3, systemd 257, flock, Tailscale 1.104.

### Phone test results ([HUMAN], see docs/phase-0.md, section F)

| # | Question | Result |
|---|---|---|
| 1 | Page loads in Safari | Yes (Autumn, iPhone, 2026-10-31) |
| 2 | Mic prompt appears, meter moves | Yes |
| 3 | Add to Home Screen works | Yes; tested as an installed app (PWA) |
| 4 | Mic permission asked again in installed app? | **Yes, every time the app is opened** |
| 5 | Asked again after fully closing and reopening? | Yes (same as 4) |
| 6 | After locking the phone 30 seconds | **Pass.** Originally audio stopped with no change on screen; the fix was confirmed working on the phone on 2026-11-08. The screen shows Paused, says why, and Resume brings the meter back |
| 7 | After switching to another app and back | **Pass.** Same behaviour as row 6, confirmed 2026-11-08 |
| 8 | Sample rate shown | Desktop browser (Mac): 48,000 Hz. iPhone: see iPhone result below |
| 9 | Stored test note still there after a few days? | **Yes**, still there on 2026-11-02 (first written 2026-10-31) |

### Identity header

- **Yes.** `Tailscale-User-Login` arrives through `tailscale serve` (Tailscale 1.104.2 on the potato) and carries the login name. Verified 2026-10-30 from the Mac with `curl https://lepotato.taild95077.ts.net:8892/api/whoami` while the lock was in `log` mode. The lock is now `enforce`, restricted to that login.
- Lock behaviour verified on the potato: through serve allowed; direct to `127.0.0.1:8892` with no header 403; wrong login 403; `/healthz` 200.

### Update path

| Check | Result |
|---|---|
| First image published to GHCR (`r26.4e14c5f`, amd64 and arm64), anonymous lookup works | Done. Verified by the agent, 2026-10-30 |
| Update from Settings works end to end | Done 2026-10-30, driven through the app's own endpoints over Tailscale: `r28.6071538` to `r29.9fbf7e3` in 22 seconds, result ok. Other services untouched |
| Update from Meridian works end to end | **Done 2026-11-08.** Autumn pressed update from Meridian; Warbler went from `r36.50f3710` to `r38.69f724b` in 22 seconds and stayed up (checked afterwards: `/healthz` ok, updater `ready`, new heartbeat). Other services untouched. Pull request AutumnsGrove/Meridian#8 (examples and docs) remains unmerged by choice |
| Deliberately broken build rolled back | First run 2026-10-30: rolled back correctly in about 23 seconds, Warbler stayed up on `r29.9fbf7e3`. **Found a bug**: the failure message contained a tab from Docker's log output, which made the result file invalid JSON, so the app showed "no result" instead of "failed". Fixed three ways (watcher escaping, app treats unreadable result as a failure, UI gives up waiting after 90s) with regression tests. Re-run after the fix, same day: rolled back in 24 seconds and the app's status endpoint showed `failed` with the readable reason; the test channel was then removed and Warbler updated normally to `r30.2db0556` |

### Meridian pull request

- AutumnsGrove/Meridian#8, opened 2026-10-30, **not merged** (Autumn wants to see the automated reviewer). `scripts/check all` green locally, including fuzzing, gitleaks and govulncheck. The reviewer workflow ran in full (Pi through OpenRouter, 2m35s, every step succeeded) and posted no comment, meaning it found nothing to flag. Its gate skips only PRs where every changed file is under `docs/`, `mockups/` or is a `.md`; this PR also changes `examples/*.yaml` and `.json`, so it was reviewed.

### Things to know

- The potato's checkout (`~/Warbler`) only changes when someone runs `git pull` there. Updates replace the image, not the compose file, the watcher script or the units. See "What does not update itself" in `docs/update.md`.

### iPhone result, first report (2026-10-31)

Reported by Autumn from the Diagnostics page on her iPhone (which of Safari or the installed app, and the answers to checklist items 3 to 7, still to be confirmed):

- Echo cancellation: **off**. iOS honoured the request.
- Noise suppression: **unknown**. Safari does not report this setting, so it is not known whether it is applied.
- Auto gain: **unknown**. Same.
- Audio base latency: **2.7 ms**.
- Desktop browser (Mac, same day): all three reported **off**; 48,000 Hz.

Open question for Phase 1: whether iOS applies automatic gain or noise suppression even though it does not report them.

**Answered 2026-11-02 (Autumn, by hand, iPhone):** she spoke softly and then loudly and the level did not get flattened; it stayed at a good level throughout. So iOS is not secretly levelling her voice. This was a by-ear check, not the guided dB test, which was therefore never built and is no longer needed. Re-check only if pitch or formant readings look oddly flat.

### What the phone results decide

- **Microphone asks every launch:** still workable. Phase 1 adds a friendly "tap to allow" first screen (per `docs/phase-0.md`).
- **Audio stops silently on lock or app switch, and the app does not notice:** fixed in code on 2026-11-02 (`web/src/lib/audio/mic.svelte.ts`, with the decision logic in `health.ts` and tests). The session now pauses when the track is muted or ended, when the app is hidden (coming back always needs a tap on Resume), and when no level readings have arrived for 1.5 seconds. Resume asks the phone for a fresh microphone stream if the old one is dead or a first Resume did not bring sound back. **Confirmed on the phone, 2026-11-08:** Autumn ran the lock, app-switch, event-log and icon checks and reported that every scenario worked. See "Phone re-test, 2026-11-08" below for what was seen and what was not captured.
- **Stored data survives at least two days** in the installed app. The unsent-session safety net in Phase 5 looks viable; re-check after a week or more.

### Decisions, 2026-11-02

- **Dark theme only.** Autumn does not want a light mode at all. Palette is warm dark browns with cream text and the same warbler yellow; every text pair measured at 6.5:1 or better (AA needs 4.5:1), button edges 4.2:1 (non-text needs 3:1). The icons, favicon, manifest colours, status bar and `theme-color` were changed to match, so the installed app has no cream flash on launch. The installed app must be removed and added to the Home Screen again on the phone to pick up the new icon and status bar style.
- **Meridian:** Autumn has applied the config snippets on the potato. An update from Meridian has not been tested because there is not yet a newer build to update to; it will be tested with the next published image (this change).

### Phone re-test, 2026-11-08

Autumn re-tested the pause and resume fix on her iPhone, on the build the potato was running at the time (`r36.50f3710`). Result: **it worked properly in every scenario that mattered.**

- Locking the screen for about 30 seconds: the app changed to Paused with a resume option instead of claiming to listen, and resuming brought the meter back.
- Switching to another app and returning: the same, as expected.
- Removing and re-adding the app to the Home Screen: the dark icon and dark launch screen were picked up.
- **Not captured:** the Diagnostics event log text. Autumn could not paste it from her phone into the chat, so exactly which signal fired first in each case is not recorded. The behaviour itself was confirmed by eye and by the meter, which is enough to accept the fix; the log remains available on the phone if a later regression needs investigating.
- **Usability finding:** the Diagnostics page has a Copy report button but getting that text off the phone into a conversation is awkward. If phone reports are needed again in a later phase, consider a way to save the report to a file or show it as a short shareable link. Not needed for Phase 0.

### Meridian update, 2026-11-08

Autumn updated Warbler from Meridian (the sibling dashboard that watches this project) and it worked end to end: `r36.50f3710` to `r38.69f724b` in 22 seconds. Checked straight afterwards from the Mac: `/healthz` reports `ok`, `/api/version` reports the new build, and the updater heartbeat is current with state `ready`. Nothing else on the potato was touched.

Worth noting for future sessions: she first thought she had already run this test, then found she had not. The check that caught it was reading the running version from the potato.

That closes the last item in Phase 0's "Done when" list.

## Phase 1

### Where the pitch analysis runs, and why it differs from PLAN.md

`PLAN.md` says the audio worklet does the decimation and the YIN pitch search. It does not, by Autumn's decision on 2026-11-08:

- The worklet only **copies** sound, in roughly 50 ms pieces, and hands each piece to a **Web Worker**.
- The worker runs the same TypeScript modules that the tests run (`web/src/lib/dsp/`).

Reason: a worklet is a separate JavaScript file loaded by the browser at run time, so vitest cannot import it. The tested maths and the running maths would have been two copies that could drift apart, and the "chunk equivalence" rule in `docs/testing.md` exists precisely because those seams are where bugs live. A copying job is small enough that it does not need tests, and it is one screen of code to review by eye.

Consequence to remember: the analysis runs off the audio thread, so a slow phone shows up as late readings, not as stuttering sound.

### Bugs the tests found (worth knowing about, in case they come back)

1. **Framer emitted windows depending on chunk size.** Copying a whole block before checking the hop meant one large block produced one window instead of several. Fixed by taking samples one at a time.
2. **One low-pass stage was not steep enough.** A 10 kHz tone folded down to 2 kHz after decimation and looked like a real pitch. Fixed with two cascaded stages (fourth-order Butterworth).
3. **YIN reported 300 Hz for a 600 Hz tone** by locking onto a lower octave. Fixed by searching the whole window and then refusing answers outside the requested range.
4. **The display smoother averaged across gaps**, inventing a value in the middle of silence. Now smoothing stops at a gap.
5. **Low pitches through strong resonances were missed entirely.** A 70 Hz synthetic voice has shallow ripples in the difference curve; taking the first dip below the threshold found a ripple, not the repeat. Now the earliest dip must be nearly as deep as the deepest one.
6. **Exactly 70 Hz was thrown away** because interpolation nudged the answer to 69.97 Hz, just under the 70 Hz floor. Now a 1% overshoot at the edge is clamped back inside; anything further out still reports nothing.

### The Python validator

- `tools/validate/synth.py` builds 34 synthetic voices (10 pitches down to 70 Hz and up to 500 Hz, three vowels, two unusual vocal-tract sizes, two noisy cases). Standard library only.
- `tools/validate/pitch_check.py` compares Praat's pitch for the same files. **Praat agrees with the known answers to within 0.08%**, so the test sounds are sound.
- The app's own measurement of those files is `web/src/lib/dsp/validation.test.ts`. It skips when the files have not been generated, so CI does not need Python.
- `make validate-pitch` runs both halves.
- **Packaging finding:** depending on `parselmouth` makes uv pull `googleads==3.8.0`, which fails to build on modern setuptools (`use_2to3 is invalid`). Depending on `praat-parselmouth` instead resolves cleanly and imports as `parselmouth`. Use that name if this is ever set up again.

### Still to do before Phase 1 can be called done

- [HUMAN] Run the Self-test screen on the phone (Settings, then Tools) and report the numbers it shows.
- [HUMAN] A 10-minute session on the phone: no heat, no stutter, no growing delay. This cannot be simulated.
- [HUMAN] The 20-minute recording session from `docs/testing.md` layer 3, into `local-recordings/`, so real-voice comparison against Praat can run.
- Autonomy: whether the trace still reads well when the phone is at arm's length is a judgement only Autumn can make.

### CI finding, 2026-11-08: Node types and the clean-room check

The first push containing `web/src/lib/dsp/validation.test.ts` failed in CI while passing locally: the test imports `node:fs` to read the Python-generated files, and CI has no Node type definitions. The local pass came from a stray `~/node_modules` in Autumn's home folder, exactly the hazard `AGENTS.md` describes.

Fix: `@types/node` added as a dev dependency of `web/`, so the type check sees what the test actually uses. After the fix, `make test-web-clean` and CI both pass, and the image for `r49.e01f40e` published.

Lesson for later phases: any test that reaches outside the browser (reading files, benchmarking) needs its types declared, or CI will disagree with the local machine.
