# Handoff

Where things stand, so the next session can start without rereading the whole history. Autumn uses she/her pronouns and is new to the technical vocabulary: explain terms plainly. Read `AGENTS.md` first, then `PLAN.md`.

Last updated 2026-11-09.

## State

**Planning is complete.** `PLAN.md` plus eight design docs in `docs/` and 30 drafted lessons in `web/content/lessons/` (all `status: draft`, all reviewed and approved by Autumn).

**Phase 0 is closed.** Warbler runs in Docker on the potato at `https://lepotato.taild95077.ts.net:8892`, behind Tailscale with the identity lock enforced. Updating works end to end both ways: the Settings button, and an update from Meridian (`r36.50f3710` to `r38.69f724b` in 22 seconds on 2026-11-08). A deliberately broken build rolls back. The host watcher and rollback are proven. CI is green and publishes a multi-arch image to `ghcr.io/autumnsgrove/warbler`. The repo is public and MIT licensed. Every item in Phase 0's "Done when" is now met and recorded in `NOTES.md`.

**Phase 1 (live pitch) is built and pushed**, live build `r53.0a88c87` (the potato is on `r51.4f3bec0` until Autumn updates). It is not closed yet: Phase 1's "Done when" needs Autumn's phone checks (Self-test numbers, 10-minute session) and the 20-minute recording session, none of which an agent can fake. Then Phase 2 (sessions and storage, `docs/data-api.md`) starts.

Also live in this phase: a "Find my starting zone" panel on Settings, so nobody has to know hertz; the practice zone is a band of plus or minus 10% around the middle pitch, never the whole speaking range.

## Phone test results (iPhone, installed app) - `NOTES.md` has the table

- Mic permission is asked **every time** the app opens. Workable; Phase 1 adds a friendly "tap to allow" screen.
- Echo cancellation honoured (off). Noise suppression and auto gain are **not reported** by iOS, so unknown. Base latency 2.7 ms.
- **Lock or app switch stops audio, and the app does not notice**: **fixed and confirmed on the phone 2026-11-08.** The screen shows Paused with a reason and a Resume button, and Resume brings the meter back. She also re-added the Home Screen app and got the dark icon and launch screen.
- Diagnostics event log text could not be copied off her phone, so no log is attached to that result. The behaviour was confirmed by eye and by the meter.
- Stored test note survived 2+ days.

## Do next

1. **Phase 1, live pitch: built, waiting on phone checks.** The analysis chain, settings, trace, stop screen, break prompt, session limit, Self-test screen, reference tone and the Python/Praat validator are all in and pushed. `make test` is green.
2. **[HUMAN] Phone checks for Phase 1** (Autumn): open Settings then Tools then Self-test and report the numbers; then a 10-minute session to check for heat, stutter and growing delay.
3. **[HUMAN] The 20-minute recording session** is still due before real-voice validation against Praat can run. Files go in `local-recordings/`, which is never committed.
4. After those, close Phase 1 and read `docs/data-api.md` for Phase 2 (sessions and storage).

## Commands for Phase 1

- `make dev` runs the Go API with the lock off plus the Vite dev server, for desktop testing.
- `make test-web` covers the analysis tests; run `make test-web-clean` before pushing anything under `web/`.
- `make validate-pitch` rebuilds the Python synthetic voices and checks Warbler against Praat.
- Hidden screens: `/self-test` (known tones through the real analyser) and `/diagnostics`.

## Facts worth knowing

- **Reach the potato:** `ssh potato-remote` (Tailscale) or `ssh potato` (home network only). Not `lepotato`. Passwordless sudo. Checkout at `~/Warbler`, port 8892.
- **The potato's checkout only changes with `git pull`.** Updates replace the image, not the compose file, watcher script or units.
- **Rollback test:** publish with `gh workflow run CI -f broken=true`, add `WARBLER_UPDATE_TAG=broken-test` to the potato's `.env`, update, then remove the line. Done twice; it found and fixed a real bug.
- **Meridian updates work** (tested 2026-11-08, `r36.50f3710` to `r38.69f724b` in 22 seconds). To tell whether an update really happened, read the running version: `curl https://lepotato.taild95077.ts.net:8892/api/version` from the Mac. Believing an update ran is not evidence; the version number is.
- Autumn's Tailscale login lives only in the potato's `.env`. Never put it in the repo.
- **Do not update the potato yourself**; Autumn does that from Settings.
- `~/node_modules` (her home folder) can make web checks pass locally while CI fails. Use `make test-web-clean`.
- Polaris and Meridian (sibling projects under `~/Documents/Projects`) are the pattern Warbler copies. Never read `Polaris/.env`.
- Docs-only pushes no longer run CI or publish an image.
- `her-go.service` on the potato has a misplaced `StartLimitIntervalSec`; harmless, not ours, mentioned to Autumn.

## Open questions for Autumn

- Does she want Meridian's reviewer shown a deliberately questionable change, to see it comment?

## Decided 2026-11-02

- The app is **dark only**, no light theme. Palette lives in `web/src/lib/styles/app.css`; icons are redrawn by `make icons`.
- The soft-then-loud test was done by hand: iOS does not level her voice. The guided dB test is dropped.
- Meridian config is applied on the potato (Autumn). PR #8 stays unmerged by choice.

## Commands

```bash
make help            # everything
make test            # all automated tests
make test-web-clean  # web checks the way CI sees them
make dev             # Go API + Vite dev server
```
