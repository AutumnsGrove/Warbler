# Phase 0: Hello mic

Goal: the smallest possible app that proves the risky parts work, before we build anything bigger. If this phase fails, we change the plan instead of piling more on top.

## What we are proving

1. An installed iPhone app can use the microphone.
2. The app can be reached privately from the phone through Tailscale, over a secure (`https`) address.
3. The potato can run it in Docker, the same way as the other projects.
4. We learn whether iOS asks for mic permission again every time the app is opened.

Question 4 is the big unknown. If iOS asks every time, the daily experience is different from what we imagined, and we need to know now.

## Plain-language glossary

- **PWA**: a website that can be added to the home screen and opens full-screen like an app.
- **Manifest**: a small file telling the phone the app's name, icon and colours, so it can be installed.
- **Tailscale serve**: gives the potato's app a private `https://...ts.net` address that only your devices can open.
- **Dev server (Vite)**: a program on your Mac that shows code changes on the phone instantly while we build.
- **Docker image**: a packaged copy of the app that runs the same on any machine. We build it on the Mac for the potato's chip type (arm64).

## Tasks

### A. Project skeleton (agent)

- `web/`: SvelteKit app set to produce plain static files.
- `server/`: a small Go program that serves those files and answers `/api/health`.
- `Makefile` with `dev`, `build`, `build-arm64`, `deploy`, `test`.
- `.gitignore` covering `data/`, recordings, `node_modules/`, build output.
- `AGENTS.md` copied from the Working agreement in `PLAN.md`.

### B. The hello page (agent)

- One screen, one big "Tap to start" button.
- On tap: ask for the mic, then show a live volume meter.
- Mic settings: echo cancellation, noise suppression and auto-gain **off** (they distort pitch measurements).
- Show the phone's real sample rate on screen. It is useful for later and proves we are reading real values.
- Show a clear message if mic permission is denied.

### C. Installable app (agent)

- Manifest, icons (placeholder warbler-bird icon is fine), `display: standalone`.
- Page title and home-screen name: "Warbler".

### D. Docker on the potato (agent, then human)

- `deploy/Dockerfile`: tiny image holding the Go program and the built web files.
- `deploy/compose.yaml`: runs it with `restart: unless-stopped`, a `data/` folder mounted so recordings survive restarts, and the port published to the potato's localhost only.
- **[HUMAN]** Tell the agent where on the potato the other Docker projects live, so Warbler's folder and compose style match. The agent can read an existing compose file if you point to one.
- **[HUMAN]** Pick a free port. The agent will propose one after seeing what is in use.

### E. Private address (agent guides, human runs)

- Run `tailscale serve` pointed at the container's port. The agent will read `tailscale serve --help` first, because options differ between versions.
- Dev setup is a second `tailscale serve` pointing at the Vite dev server on the Mac, on a different port, so both can run at once.
- **[HUMAN]** Run the commands the agent gives you on the potato and Mac.

### F. The real test (human)

Do these in order on the iPhone and write down what happens. The agent will put your answers in `NOTES.md`.

1. Open the Warbler address in Safari. Does the page load?
2. Tap Start. Does iOS ask for the mic? Allow it. Does the meter move when you talk?
3. Add to Home Screen. Open the installed app.
4. Tap Start again. **Does it ask for mic permission again?**
5. Fully close the app (swipe it away), reopen it, tap Start. **Asked again?**
6. Lock the phone for 30 seconds with the meter running, then unlock. What state is the app in?
7. Switch to another app and back while the meter runs. What happens?
8. Read the sample rate shown on screen and note it.

## Done when

All of F is answered and written in `NOTES.md`, and the app runs from the potato's Docker container (not only the dev server).

## Decision at the end of Phase 0

- Mic asks **once**, or stays allowed: continue as planned.
- Mic asks **every launch**: still workable, but we add a friendly "tap to allow" first screen, and note it in Phase 1.
- Mic does **not work** in the installed app at all: we stop and look at alternatives before building more.

## Open questions for the agent to resolve while building

- Is the potato's Docker able to build arm64 images directly, or do we build on the Mac and send the image over? (Default: build on the Mac with `docker buildx`.)
- Does the existing `tailscale serve` setup on the potato already use ports we must avoid?
