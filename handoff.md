# Handoff

Where things stand, so the next session can start without rereading the whole history. Autumn uses she/her pronouns and is new to the technical vocabulary: explain terms plainly. Read `AGENTS.md` first, then `PLAN.md`.

Last updated 2026-11-02 (later).

## State

**Planning is complete.** `PLAN.md` plus eight design docs in `docs/` and 30 drafted lessons in `web/content/lessons/` (all `status: draft`, all reviewed and approved by Autumn).

**Phase 0 is built, live and almost finished** (waiting on the phone re-test of the audio fix and a Meridian update). Warbler runs in Docker on the potato at `https://lepotato.taild95077.ts.net:8892`, behind Tailscale with the identity lock enforced. Updating works end to end (Settings button, and the host watcher with rollback). CI is green and publishes a multi-arch image to `ghcr.io/autumnsgrove/warbler`. The repo is public and MIT licensed.

## Phone test results (iPhone, installed app) - `NOTES.md` has the table

- Mic permission is asked **every time** the app opens. Workable; Phase 1 adds a friendly "tap to allow" screen.
- Echo cancellation honoured (off). Noise suppression and auto gain are **not reported** by iOS, so unknown. Base latency 2.7 ms.
- **Lock or app switch stops audio, and the app does not notice** (still says "Listening"). This is a bug to fix next, see below.
- Stored test note survived 2+ days.

## Do next

1. **Phone re-test of the audio fix** (Autumn): open the app, tap start, lock the phone for 30 seconds, unlock; then switch to another app and back. Expect "Paused" with a Resume button, and Resume bringing the meter back. The Diagnostics event log shows what fired. Also remove and re-add the app to the Home Screen to see the dark icon. Record results in `NOTES.md` table rows 6 and 7.
2. **Meridian step 10** (Autumn): config is applied. Once this change is published to GHCR (push to main, CI green), try an update from Meridian and record it.
3. **Close Phase 0** when 1 and 2 pass, then start Phase 1 (live pitch). Read `docs/testing.md` first: the 20-minute recording session is due before pitch validation.

## Facts worth knowing

- **Reach the potato:** `ssh potato-remote` (Tailscale) or `ssh potato` (home network only). Not `lepotato`. Passwordless sudo. Checkout at `~/Warbler`, port 8892.
- **The potato's checkout only changes with `git pull`.** Updates replace the image, not the compose file, watcher script or units.
- **Rollback test:** publish with `gh workflow run CI -f broken=true`, add `WARBLER_UPDATE_TAG=broken-test` to the potato's `.env`, update, then remove the line. Done twice; it found and fixed a real bug.
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
