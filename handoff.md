# Handoff

Where things stand, so the next session can start without rereading the whole history. Autumn uses she/her pronouns and is new to the technical vocabulary: explain terms plainly. Read `AGENTS.md` first, then `PLAN.md`.

Last updated 2026-11-02.

## State

**Planning is complete.** `PLAN.md` plus eight design docs in `docs/` and 30 drafted lessons in `web/content/lessons/` (all `status: draft`, all reviewed and approved by Autumn).

**Phase 0 is built, live and almost finished.** Warbler runs in Docker on the potato at `https://lepotato.taild95077.ts.net:8892`, behind Tailscale with the identity lock enforced. Updating works end to end (Settings button, and the host watcher with rollback). CI is green and publishes a multi-arch image to `ghcr.io/autumnsgrove/warbler`. The repo is public and MIT licensed.

## Phone test results (iPhone, installed app) - `NOTES.md` has the table

- Mic permission is asked **every time** the app opens. Workable; Phase 1 adds a friendly "tap to allow" screen.
- Echo cancellation honoured (off). Noise suppression and auto gain are **not reported** by iOS, so unknown. Base latency 2.7 ms.
- **Lock or app switch stops audio, and the app does not notice** (still says "Listening"). This is a bug to fix next, see below.
- Stored test note survived 2+ days.

## Do next

1. **Fix silent audio loss** in `web/src/lib/audio/mic.svelte.ts`: also watch the track's `mute` and `ended` events, treat the app being hidden as a pause, check the track is live when the app returns, then show "Paused" with a Resume button (iOS needs a tap). Run `make test-web-clean` before pushing.
2. **Decide on the soft-then-loud test** (about 30 seconds on Diagnostics, reports the level gap in dB) to learn whether iOS secretly levels the voice. Autumn has not said yes or no. Recommended before Phase 1.
3. **Meridian.** PR AutumnsGrove/Meridian#8 is open and **deliberately unmerged** (Autumn wants to see the reviewer; it ran in full and posted no comment). Applying `deploy/meridian/` snippets to the root-owned `/etc/meridian/{targets,observe}.json` on the potato is Autumn's step, then test an update from Meridian (runbook step 10).
4. Close Phase 0: finish step 10, update `NOTES.md`, then start Phase 1 (live pitch). Read `docs/testing.md` first: the 20-minute recording session is due before pitch validation.

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

- Soft-then-loud test: yes or no?
- Does she want Meridian's reviewer shown a deliberately questionable change, to see it comment?
- A real dark theme? The app is light only; her screenshots looked dark, probably a browser or extension forcing it.

## Commands

```bash
make help            # everything
make test            # all automated tests
make test-web-clean  # web checks the way CI sees them
make dev             # Go API + Vite dev server
```
