# Phase 0: Hello mic and update path

The first gate. It proves the risky parts work before anything bigger is built on top. If something here fails, we change the plan instead of piling more on.

## What this phase proves

1. An installed iPhone app can use the microphone, and we learn whether iOS asks permission again each time.
2. Warbler runs in Docker on the potato, reached privately through Tailscale over a secure (`https`) address.
3. The Tailscale identity header reaches the server (our second lock).
4. Updating works: from Warbler's own Settings, and from Meridian. A broken update rolls back by itself.
5. We learn whether iOS keeps the app's stored data across days of non-use.

## What is already built (by the agent)

| Piece | Where | Tested |
|---|---|---|
| Server: `/healthz`, version, update endpoints, identity lock, Host check, embedded app | `server/` | `go test -race` |
| Web app: tap-to-start, live volume meter, Settings with About and updates, Diagnostics | `web/` | type check, unit tests, build |
| App icons (a small yellow bird), manifest, Lexend font and Lucide icons bundled | `web/static/`, `tools/icons/` | the build check below |
| Check that the built app mentions no outside web addresses | `scripts/` | its own tests |
| Docker image (3.5 MB, read-only, non-root) and compose file | `Dockerfile`, `docker-compose.yml` | built and run locally, then published and run from GHCR |
| Host update watcher, systemd units, installer, Meridian snippets | `deploy/` | 59 checks with a fake Docker |
| GitHub Actions: tests on every push, publish image from `main` | `.github/workflows/ci.yml` | green on GitHub; first image published (`r26.4e14c5f`) |

## Words used here

- **Image / Docker:** the packaged copy of the app the potato runs.
- **GHCR:** GitHub's storage for images. Our build publishes each new version there.
- **Tailscale serve:** gives the potato's app a private `https` address that only your devices can open.
- **Identity header:** a note Tailscale adds to each request saying which of your accounts sent it.
- **PWA:** a website installed to your home screen so it looks like an app.
- **Watcher:** the small script on the potato that does the actual updating when asked.

---

## Your steps

Each step says what to do, what you should see, and what to tell me if it differs. Total time: about an hour, plus a few days for the last check.

### Step 1. Check the port is free (potato, 1 minute)

Open a terminal on the potato (SSH in the way you normally do). I could not do this myself: SSH from the Mac asked about the host key, which I did not want to override.

```bash
ss -ltn | grep 8892 || echo "port 8892 is free"
```

**You should see:** `port 8892 is free`. If something else answers, tell me and I will pick another port (it is one setting).

### Step 2. Get the code onto the potato (potato, 2 minutes)

```bash
git clone https://github.com/AutumnsGrove/Warbler.git ~/Warbler
```

If a folder called `~/Warbler` already exists, tell me before doing anything.

### Step 3. Check the image is available (nothing to do)

GitHub has already built the first image and published it for both phone-class and laptop-class chips (`linux/arm64` for the potato, `linux/amd64`). It is public: I checked that an anonymous request, which is what the potato's update watcher makes, gets an answer. You can see it at `https://github.com/users/AutumnsGrove/packages/container/package/warbler`.

(The image holds only the program and the built web app: no recordings, no settings, no lessons.)

### Step 4. Install on the potato (potato, 5 minutes)

First find your two Tailscale details:

```bash
tailscale status --self --json | grep -m1 '"DNSName"'     # your potato's address, like lepotato.taild95077.ts.net.
tailscale status --self --json | grep -m1 '"LoginName"'   # your Tailscale login, usually an email
```

Then (leave off the final dot of the address):

```bash
cd ~/Warbler
deploy/install.sh --login YOUR-LOGIN --host YOUR-POTATO-ADDRESS --dry-run   # shows the plan, changes nothing
deploy/install.sh --login YOUR-LOGIN --host YOUR-POTATO-ADDRESS
```

The installer creates the folders, writes a settings file (`.env`), installs the update watcher (it asks for your password once, to install system services), starts Warbler, and prints a checklist.

**You should see:** `warbler-update.path active`, `warbler-tick.timer active`, and `{"status":"ok","version":"r..."}`.

### Step 5. Make it reachable from your phone (potato, 1 minute)

```bash
tailscale serve --help | head -30     # flags have changed between versions: check this matches
tailscale serve --bg --https=8892 http://127.0.0.1:8892
tailscale serve status
```

If the command is rejected, paste me the `--help` output and I will give you the exact form for your version.

### Step 6. First look on your phone (phone, 5 minutes)

With Tailscale on, open `https://YOUR-POTATO-ADDRESS:8892` in Safari.

**You should see:** the Warbler page with a yellow bird and a "Tap to start" button.

Then open **Settings**, then **Diagnostics**. Under **Server lock** it should say the **identity header arrived**, with your login. That is the check that matters. Tell me:

- Did it say "arrived"? If it says "did not arrive", the lock cannot be turned on yet, and I need to adapt it.

### Step 7. Turn the lock on (potato, 1 minute)

Only after step 6 says "arrived":

```bash
cd ~/Warbler
sed -i 's/^WARBLER_LOCK=.*/WARBLER_LOCK=enforce/' .env
docker compose up -d
```

Reload the page on your phone. It should still work. (Opening the address some other way, such as from a different network without Tailscale, should now be refused.)

### Step 8. The phone test (phone, 15 minutes)

The point is to find out how iOS behaves. Do these in order, and note what happens. After each, the **Events** list on the Diagnostics page records what the app saw.

1. Open Warbler in **Safari**. Tap **Tap to start**, allow the microphone, say something. Does the bar move?
2. Add it to your home screen (Share, then **Add to Home Screen**). Open it **from the icon**.
3. Tap **Tap to start** again. **Does iOS ask for the microphone again?**
4. Swipe the app away completely, open it again from the icon, tap start. **Asked again?**
5. With the meter running, lock your phone for 30 seconds, then unlock. What state is the app in? (Paused? Still running?)
6. With the meter running, switch to another app and come back. What happens?
7. Look at **Diagnostics**: write down the **sample rate**, and whether **echo cancellation, noise suppression and auto gain** say "off". (We asked iOS to turn them off, and it may ignore us.)
8. Tap **Copy report** on Diagnostics and paste it to me.
9. **A few days later**, open Diagnostics again. Does it say the stored test note is "still here"? (This tells us whether iOS keeps an installed app's stored data.)

I will fill your answers into `NOTES.md`.

### Step 9. Update from Settings (phone, 5 minutes)

I will push a tiny visible change (for example a different version number). When CI has published it:

1. Settings, then **Check for updates**. After a few seconds it should say a newer version is ready.
2. **Update now**. It shows "Updating", and then the page reloads by itself on the new version.

If it says "Updates are not set up on this server", the watcher is not running. Tell me what `systemctl status warbler-update.path` says.

### Step 10. Update from Meridian (about 10 minutes)

Meridian's allowlist is root-owned, so this part is yours to apply. Ready-made pieces are in `deploy/meridian/`:

1. `sudoedit /etc/meridian/targets.json`: add the `warbler` entry from `targets-snippet.json`.
2. `sudoedit /etc/meridian/observe.json`: add `warbler-update.path`, matching the shape of the existing entries (see `observe-snippet.json`).
3. Add the tile from `config-snippet.yaml` to `~/Meridian/config.yaml`, then reload Meridian (`docker kill -s HUP meridian`).

Then open Meridian. Warbler should show a green dot and its version. After I push another small change, tap **Update** on Warbler's row in Meridian's control page.

If you would rather I make these as a pull request to the Meridian repository, say so.

### Step 11. The rollback test (needs both of us, 10 minutes)

I will push a version that deliberately fails to start. You tap Update. **Expected:** Warbler says the update did not work and the previous version is running again, with the reason. I then push a fix. This proves the safety net before we rely on it.

---

## Done when

- You have completed the phone checklist in step 8 and I have recorded the answers in `NOTES.md`.
- The app runs from the Docker container on the potato, pulled from GHCR.
- An update from Settings works end to end.
- An update from Meridian works end to end.
- The rollback test showed the previous version coming back.
- The identity header check passed and the lock is on.

## What the answers decide

| If you see... | Then... |
|---|---|
| The microphone asks **once** and stays allowed | Continue as planned |
| The microphone asks **every launch** | Still workable. Phase 1 adds a friendly "tap to allow" first screen |
| The microphone **does not work** in the installed app | We stop and look at alternatives before building more |
| The stored test note is **gone** after days | The unsent-session safety net needs a different design (Phase 5 changes) |
| Echo cancellation or noise suppression says **on** | We note it. Phase 1 will measure how much it affects pitch, and may need workarounds |
| The identity header **does not arrive** | The server lock needs a different approach before it can be turned on |

## Open questions I could not settle from the Mac

- Is port **8892** free on the potato, and is **`~/Warbler`** the right folder? (Steps 1 and 2.)
- Does the installed Tailscale version still accept `tailscale serve --bg --https=8892 http://127.0.0.1:8892`? (Step 5.)
- Does the identity header have the name `Tailscale-User-Login` there? (Step 6.)
