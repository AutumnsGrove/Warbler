# In-app updates

How Warbler updates itself on the potato, from three places: a button in Warbler's own Settings, a tap in Meridian (the app hub), or a command typed by hand. All three run the same code, so there is only one thing to test and trust.

This copies the pattern Polaris and Meridian already use, with two deliberate differences, explained below.

## Words used here

- **Image:** the packaged copy of the app that Docker runs. A new version of Warbler is a new image.
- **GHCR:** GitHub's place to store images (`ghcr.io`). Our automatic build publishes each new image there.
- **Digest:** a long fingerprint (`sha256:` followed by 64 characters) that names one exact image. Using the digest, not a nickname like `latest`, means you get precisely the build you were shown.
- **Pin:** write that digest into a settings file so Docker uses exactly that image.
- **Watcher:** a small script that runs on the potato itself, outside any container, and does the real update work. The app only asks it to.
- **systemd unit:** how Linux runs background jobs. A **path unit** watches for a file to appear and starts a **service unit** when it does.
- **Signal file:** a small file the app writes into a shared folder to ask the watcher for something. The watcher answers by writing a result file.
- **Rollback:** putting the previous version back if the new one does not start properly.

## Why the app does not update itself directly

The app runs in a locked-down container with no power over Docker. That is deliberate: if the app were ever tricked or buggy, it still could not control the machine. So the app only drops a note in a shared folder, and a separate, small, reviewed script on the potato does the update.

## Difference 1: the container never goes online

Polaris looks up the newest version on GHCR from inside its own container. Warbler's rule is that the app makes no outside calls, ever. So here:

- The **app** never contacts GHCR. It only writes and reads signal files.
- The **watcher** (on the host) does the GHCR lookup and the pull, and only when a signal file exists. It does nothing on its own.

This means the plan's privacy wording changes slightly: the only outside traffic on the potato caused by Warbler is the watcher fetching a new Warbler image from GitHub when you (or Meridian) ask for an update.

## Difference 2: a bare start works

Polaris's watcher does nothing unless the app first wrote the exact image it wants. Meridian, though, updates an app by simply starting its update unit. So Warbler's watcher handles both:

- A signal file exists: use what it asks for (the check or the update).
- No signal file (started by Meridian or by hand): treat it as "update to the newest image", resolve it on the host, then continue as normal.

## The flow

```
 Warbler Settings  ──[Check]──►  update-signal/check
                                      │  warbler-update.path sees the file
                                      ▼
                              warbler-update.service (oneshot, runs the watcher)
                                      │  asks GHCR for the digest of :latest
                                      ▼
                              update-signal/available.json
 Warbler Settings  ◄── reads ─────────┘     { current, latest, checked_at }

 Warbler Settings  ──[Update]──►  update-signal/requested   (just the word "latest")
 Meridian tap  ──► systemctl start warbler-update.service    (no file at all)
 by hand       ──► sudo systemctl start warbler-update.service

                              the watcher then:
                                1. resolves :latest to a digest and checks its shape
                                2. waits (up to 60s) for any upload in progress
                                3. asks the running app to make a database snapshot
                                4. pins the new digest in .env, pulls, recreates the container
                                5. polls the container's health for up to 120s
                                6. healthy: write result "ok".
                                   unhealthy: restore the snapshot, pin the old digest,
                                   recreate, write result "failed" with the reason.
```

The page the user is looking at is served by the very container being replaced. So the app polls `/healthz` (tolerating the server vanishing for a while) until the version string changes, then reloads. This is the same approach Polaris uses.

## Signal folder

`~/Warbler/update-signal/` on the host, mounted into the container at `/data/update-signal`. Every file is written to a temporary name and renamed into place, so the watcher never sees half a file.

| File | Written by | Meaning |
|---|---|---|
| `check` | app | Please look up the newest version. Content is ignored |
| `available.json` | watcher | `{ "current": "aaaaaaaaaaaa", "latest": "bbbbbbbbbbbb", "latest_digest": "sha256:...", "checked_at": "...", "update_available": true }`. `current` and `latest` are the first 12 characters of each image digest, because a digest does not carry the friendly version name. After an update, Settings shows the new version name from the running app |
| `requested` | app | Please update. The content is the word `latest`. The app **never** supplies an image name or digest |
| `result` | watcher | `{ "status": "ok" or "failed" or "skipped", "detail": "...", "target": "...", "finished_at": "..." }` |
| `heartbeat` | watcher | Timestamp refreshed every time the timer fires, so the app can show "updates are not set up on this server" if it goes stale |

The app never accepts an image reference from the browser or anywhere else. The watcher has the allowed repository (`ghcr.io/autumnsgrove/warbler`) written into it, and refuses anything that is not exactly that repository plus `@sha256:` and 64 lowercase hex characters.

## What the app provides

| Endpoint | Locked? | Purpose |
|---|---|---|
| `GET /healthz` | no (for Docker's health check and Meridian) | `{"status":"ok","version":"r123.abc1234"}`. Nothing else. No personal data |
| `GET /api/version` | yes | Version, build time, deployment mode (`docker`), updater state (`ready`, `not installed`) |
| `POST /api/update/check` | yes | Writes `check` |
| `GET /api/update/available` | yes | Reads `available.json` |
| `POST /api/update/start` | yes | Writes `requested` (content: `latest`) |
| `GET /api/update/status` | yes | Reads `result` and whether `requested` still exists (so it is clear when the answer is about this run) |
| `GET /api/busy` | no (called on the potato itself, and harmless) | `{"busy":true}` while an upload is in progress; the watcher waits on it |

"Locked" means the Tailscale identity check from `docs/data-api.md`. `/healthz` and `/api/busy` are exempt because Meridian and the watcher call them on the potato itself, not through `tailscale serve`. Neither returns anything personal: one says the app is alive and which build it is, the other says whether an upload is running.

## What the Settings screen shows

```
┌──────────────────────────────┐
│  About                       │
│                              │
│  Version      r124.def5678   │
│  Installed    Docker         │
│  Updates      ready          │
│                              │
│  Up to date                  │
│  Last checked  2 hours ago   │
│  ┌────────────────────────┐  │
│  │   Check for updates    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

States, each with plain wording and no alarm colours:

| State | What it says | Buttons |
|---|---|---|
| Up to date | "Up to date." and when it was last checked | Check for updates |
| Update available | "A newer version is ready: bbbbbbbbbbbb." | Update now |
| Updating | "Updating. This takes a minute. Warbler will reload when it is done." | none |
| Done | "Updated to r125.abc9999." | none |
| Failed | "The update did not work, and the previous version is running again." plus the reason from the watcher in small print | Try again |
| Failed and rollback failed | "The update did not work and Warbler may not be running properly. Check the potato." | none |
| No updater | "Updates are not set up on this server." plus a short link to the install steps | none |

Update is refused while a session is recording on the phone ("Finish your session first"), since the app drops its connection while it restarts. Unsent sessions are safe anyway because of the phone-side retry buffer, but a recording in progress should not be interrupted.

## The watcher in detail

Files (in the repo, installed by `deploy/install.sh`):

```
docker-compose.yml              # at the repo root, like Polaris, so Meridian's compose actions find it
Dockerfile
deploy/
├── install.sh                  # one-time setup on the potato
├── watcher/
│   ├── update.sh               # the script described here
│   ├── warbler-update.path     # starts the update service when check or requested appears
│   ├── warbler-update.service  # oneshot, runs update.sh as the deploy user
│   ├── warbler-tick.service    # oneshot, runs update.sh --tick
│   ├── warbler-tick.timer      # every 10 minutes: refresh the heartbeat, pick up any missed signal
│   └── test.sh                 # 59 checks with a fake docker and curl
└── meridian/                   # snippets for Meridian (see below), not used by Warbler itself
```

The potato holds a checkout of this repository (for example `~/Warbler`), as it does for Polaris. The compose file, the watcher script and the units come from that checkout. The running app comes from the image.

Rules (taken from Polaris's script, plus the additions marked new):

- Runs as the deploy user (in the `docker` group), **not root**, so no root-owned files appear in the checkout.
- One run at a time (`flock`). A second trigger while one is running quietly exits.
- Every external command has a timeout (pull 300s, recreate 60s, snapshot 60s, GHCR lookup 15s).
- Writes the result file on **every** exit path.
- **New:** resolves the digest itself from GHCR (a two-step anonymous request, as Polaris's Go code does), so the app does not have to.
- **New (and the app side is a stub until Phase 2, when the database exists):** takes a database snapshot through the running container before recreating (`docker compose exec -T warbler /app/warbler snapshot`, which writes `data/backups/pre-update.db`; the file is overwritten each update). If the new version fails its health check, the watcher restores that snapshot before starting the previous image. Reason: our database migrations only go forward, so an older version may not understand a newer database.
- **New:** waits up to 60 seconds for `/api/busy` to say no uploads are in progress.
- **New:** `check` mode never changes anything. It only writes `available.json`.
- Health check: Docker's own check (the binary runs `warbler healthcheck`, a tiny request to `/healthz`, since the final image has no shell or `wget`). Polls up to 120 seconds.
- The timer backstops a missed file notification. It acts only if a signal file exists, and always refreshes the heartbeat. It never updates by itself.

## The image and its publishing

- `ghcr.io/autumnsgrove/warbler`, built for `linux/amd64` and `linux/arm64` (the potato is arm64) by GitHub Actions on every push to `main` that passes tests. Tags: `latest` and the short commit id. A `vX.Y.Z` git tag adds a version tag.
- The version string is `r<commit count>.<short sha>`, the same format as Polaris, stamped into the binary at build time. Meridian shows it as a version vital.
- The final image is minimal: the Go program only, run as a non-root user. No shell, no package manager.
- **[HUMAN]** The first publish creates a GHCR package. It must be set to public (or the potato must be logged in to GHCR) before the watcher can pull it anonymously. Linking the package to the repo through the image's `org.opencontainers.image.source` label makes it inherit the repo's public setting.

## Using it from Meridian

Meridian can update Warbler the same way it updates Polaris and Ivy, with no new code in Meridian. Three small additions on the potato, all yours to make because they are root-owned or live in Meridian's config:

1. In `/etc/meridian/targets.json`:

```json
"warbler": {
  "kind": "compose",
  "dir": "/home/autumn/Warbler",
  "service": "warbler",
  "actions": ["start", "stop", "restart", "update"],
  "criticality": "low",
  "update": { "kind": "unit", "unit": "warbler-update.service" }
}
```

2. In `/etc/meridian/observe.json`: add `warbler-update.path` so Meridian reports whether the updater is installed.
3. In Meridian's `config.yaml`: a tile that probes `http://localhost:8892/healthz` and shows the `version` field as a vital, like Polaris's. A ready-made block is in `deploy/meridian/config-snippet.yaml`.

Because Meridian's tap starts `warbler-update.service` with no signal file, the "bare start works" rule above is what makes the tap a complete update.

## Safety summary

| Risk | Handled by |
|---|---|
| App tricked into pulling a malicious image | The app cannot name an image. Only the watcher chooses, and only from one hard-coded repository, by digest |
| Update lands a broken version | 120-second health check, automatic rollback, database snapshot restored |
| Database no longer matches older code after a failed update | Snapshot restore before rollback; the server also refuses to start if the database is newer than it understands |
| Update interrupts an upload | Watcher waits for `/api/busy` up to 60 seconds; the phone's retry buffer covers anything else |
| Two updates at once | `flock` |
| Watcher not installed | Heartbeat goes stale, Settings says "Updates are not set up" |
| Files owned by root in the project folder | Watcher runs as the deploy user |
| Half-written signal files | Write to temp name, then rename |

## Testing

- `deploy/watcher/test.sh` (59 checks) runs the real script against a fake `docker`, `curl`, `timeout` and `sleep` placed first on the path. Cases: bare start resolves and updates; signal file requests an update; `check` only writes `available.json`; malformed digest refused; wrong repository refused; pull fails (previous digest restored, container untouched); recreate fails (rollback); unhealthy after start (snapshot restored, rollback); rollback itself fails (distinct message); second run while locked exits quietly; busy wait times out and continues; timeout paths.
- Go tests cover the update endpoints with a temporary signal folder: writes are atomic, status reads are correct, the app refuses to write `requested` with any content other than `latest`, `/api/busy` is loopback-only, `/healthz` leaks nothing.
- GitHub Actions runs both on every push.
- Manual, in Phase 0: publish two versions, update from Warbler's Settings, update from Meridian, and deliberately publish a broken one to watch the rollback.

## Decisions to confirm

1. **Port.** Meridian's docs show these ports in use: 8891 (Meridian), 8899 (Polaris), 8418 (Ivy), 8890 (bwmon), 8888 (SearXNG), 8081 (Vaultwarden). Warbler uses **8892**. Please confirm it is free on the potato (`ss -ltn`). It is one setting (`WARBLER_PORT` in `.env`).
2. **Folder name.** `~/Warbler` on the potato, matching how `~/Polaris` and `~/ivy` are laid out.
3. **Meridian changes.** The three small additions live in Meridian's config and the root-owned allowlist. Ready-made snippets are in `deploy/meridian/`. Say if you want them as a pull request in the Meridian repository instead.
4. **First image visibility.** The first publish creates a GHCR package. It must be public (or the potato logged in to GHCR) for the watcher to pull it anonymously.
