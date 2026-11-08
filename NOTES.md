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
