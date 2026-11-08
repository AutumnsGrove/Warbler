# Handoff

Where things stand, so the next session can start without rereading the whole history. Autumn uses she/her pronouns and is new to the technical vocabulary: explain terms plainly. Read `AGENTS.md` first, then `PLAN.md`.

Last updated 2026-11-08.

## State

**Planning is complete.** `PLAN.md` plus eight design docs in `docs/` and 30 drafted lessons in `web/content/lessons/` (all `status: draft`, all reviewed and approved by Autumn).

**Phase 0 is built and live, and every phone check now passes.** Warbler runs in Docker on the potato at `https://lepotato.taild95077.ts.net:8892`, behind Tailscale with the identity lock enforced. Updating works end to end (Settings button, and the host watcher with rollback). CI is green and publishes a multi-arch image to `ghcr.io/autumnsgrove/warbler`. The repo is public and MIT licensed.

One gate item remains: an update from Meridian has still not been tested end to end, because until the 2026-11-08 merge there was no newer image to update to. A newer image now exists, so the test is possible and should be done before pressing Update in Settings.

## Phone test results (iPhone, installed app) - `NOTES.md` has the table

- Mic permission is asked **every time** the app opens. Workable; Phase 1 adds a friendly "tap to allow" screen.
- Echo cancellation honoured (off). Noise suppression and auto gain are **not reported** by iOS, so unknown. Base latency 2.7 ms.
- **Lock or app switch stops audio, and the app does not notice**: **fixed and confirmed on the phone 2026-11-08.** The screen shows Paused with a reason and a Resume button, and Resume brings the meter back. She also re-added the Home Screen app and got the dark icon and launch screen.
- Diagnostics event log text could not be copied off her phone, so no log is attached to that result. The behaviour was confirmed by eye and by the meter.
- Stored test note survived 2+ days.

## Do next

1. **Meridian step 10** (Autumn): config is applied. A newer image now exists, so try an update from Meridian and record it in `NOTES.md`. Do this before updating from Settings, otherwise Meridian has nothing newer to find.
2. **Close Phase 0** once that passes, then start Phase 1 (live pitch). Read `docs/testing.md` first: the 20-minute recording session is due before pitch validation.

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
