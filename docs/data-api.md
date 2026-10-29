# Data and API design

What Warbler saves, where it lives, and how the phone and the potato talk to each other. This expands the "Data model and API" section of `PLAN.md`, which stays the short summary.

Words used here:

- **Database (SQLite):** a single file holding organised tables of information, like a very tidy spreadsheet the app can search quickly. It lives on the potato.
- **API / endpoint:** the "menu" of requests the phone can make to the potato, such as "save this session" or "list my sessions". Each item on the menu is an endpoint, written like `GET /api/sessions`.
- **Migration:** a small versioned script that changes the database's shape when the app is updated, so old data is never lost.
- **Idempotent:** doing the same request twice has the same effect as doing it once. Essential on a phone, where a dropped connection may make the app retry.
- **Transaction:** a group of database changes that either all happen or none do.
- **Checksum (hash):** a short fingerprint of a file. If even one byte changes, the fingerprint changes. We use it to confirm a file arrived intact.
- **Blob:** a chunk of raw data stored as a file, as opposed to a neat table row.

## 1. The big picture

Three kinds of things are stored:

| Kind | Examples | Where | Size |
|---|---|---|---|
| **Records** (small, searchable) | sessions list, settings, lesson progress, weekly reports, feel tags | SQLite database file | tiny |
| **Recordings** (large) | your voice audio, call-simulator audio | WAV files on disk | about 58 MB per 30 minutes |
| **Series** (medium) | the pitch and resonance numbers for every moment of a session, for fast charts | compressed files on disk | about 1 MB per session |

Records point to files by id. The files never carry information that exists nowhere else: the audio is the master copy, and everything else can be recomputed from it.

**Rough storage maths.** Audio is 16,000 samples per second at 2 bytes each, so about 1.9 MB per minute. Four 15-minute sessions a week is roughly 115 MB a week, or about 6 GB a year, out of 256 GB. Keeping everything is comfortable for decades.

### Folder layout on the potato

Mounted into the container as `/data`, mapped to a normal folder on the potato so the data survives container updates.

```
data/
├── warbler.db            the database (plus warbler.db-wal and -shm while running)
├── audio/
│   └── {session-id}.wav
├── series/
│   └── {session-id}.wbs.gz
├── scenarios/            call-simulator audio, copied in at deploy time
│   └── {scenario-id}/{node-id}-{variant}.mp3
├── tmp/                  uploads in progress (cleaned on start)
└── backups/              database snapshots made by the app (Phase 8)
```

Folder permissions are private to the container's user. The container runs as a normal user, not root.

## 2. The database

### Settings of the database engine

- **WAL mode** (write-ahead logging): lets the app read while writing and survives a sudden power cut on the potato without corrupting data.
- **Foreign keys on**: the database refuses links to things that do not exist.
- **Strict tables**: wrong types are rejected rather than quietly accepted.
- One writer at a time. This is a personal app with one user, so simplicity beats cleverness.

### Time handling

Every time is stored three ways, because weeks must follow **your** calendar, not UTC:

- `started_at`: exact moment in UTC (for example `2026-10-29T18:04:11Z`).
- `tz_offset_min`: your phone's offset from UTC at the time (for example `-240`).
- `local_date`: the calendar date on your phone (for example `2026-10-29`).

Weekly grouping uses `local_date`, with the week starting on the day set in Settings (default Sunday). Travelling or daylight-saving changes can then never split a week wrongly.

### Tables

All ids are UUIDs made by the phone, so retries are safe.

**`sessions`**

| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `kind` | `practice`, `lesson`, `weekly_passage`, `free`, `call_sim` |
| `started_at`, `ended_at`, `tz_offset_min`, `local_date` | see Time handling |
| `duration_s` | seconds actually recorded (excludes pauses) |
| `lesson_id` | optional |
| `passage_id` | optional |
| `scenario_id` | optional, for `call_sim` |
| `sample_rate` | audio file rate (16000) |
| `device_sample_rate` | the phone's original capture rate, for diagnostics |
| `audio_path`, `audio_sha256`, `audio_bytes` | the WAV and its fingerprint |
| `series_path`, `series_sha256` | the series file and fingerprint |
| `settings_snapshot` | JSON: settings in force during the session (zones, ramp, ceiling, search range) |
| `summary` | JSON: see Summary below |
| `analysis_version` | integer: which version of the analysis code produced the series and summary |
| `timeline` | JSON, call sessions only: when each caller line started and stopped, so replay can mix both sides |
| `created_at` | when the server received it |

**`session_tags`**: `session_id`, `tag_id`. The feel tags (`easy`, `steady`, `effortful`, `tired`, `tight`, `scratchy`, `warmed_up`, `rested`, `thirsty`, `congested`, `noisy_room`). The list of valid ids is in the code, not the database, so renaming a chip's label never touches your data.

**`lesson_completions`**: `id`, `lesson_id`, `completed_at`, `local_date`, `session_id` (optional). One row per completion. A lesson can be done more than once (the coach may suggest revisiting), so this is a log rather than a single "done" flag.

**`weekly_reports`**: `id`, `week_start` (local date), `session_id` (the passage recording used), `stats` (JSON), `plan` (JSON, including which rules fired and the plain-language reason for each), `coach_version`, `created_at`, `superseded_by` (if recomputed). Reports are never silently overwritten: a recomputation (for example after re-analysis) adds a new row and links the old one.

**`settings`**: exactly one row: `version` (an integer that goes up on every save), `updated_at`, `data` (JSON, see Settings).

**`schema_migrations`**: which migrations have run.

### Summary JSON (per session)

```json
{
  "f0": { "median": 196.2, "p10": 168.0, "p90": 241.5, "sd_semitones": 2.8 },
  "voiced_fraction": 0.62,
  "loudness": { "median_dbfs": -28.1, "clipped_fraction": 0.0 },
  "noise_floor_dbfs": -61.0,
  "formants": { "f1": 520, "f2": 1480, "f3": 2600, "confident_fraction": 0.71 },
  "analysis": { "version": 1, "formant_ceiling_hz": 5500, "f0_range_hz": [70, 500] }
}
```

`formants` is absent until Phase 4. `noise_floor_dbfs` and `clipped_fraction` feed the weekly recording checks in `docs/coach.md`.

### Settings JSON

```json
{
  "mode": "targets",                    // "targets" or "just_my_voice"
  "pitch_zone_start":  { "lo": 165, "hi": 200 },
  "pitch_zone_target": { "lo": 190, "hi": 230 },
  "resonance_zone_start":  null,        // Phase 4
  "resonance_zone_target": null,
  "ramp_percent": 25,
  "session_cap_min": 30,
  "break_every_min": 10,
  "f0_search_range": [70, 500],
  "formant_ceiling_hz": 5500,
  "show_note_names": true,
  "streaks": false,
  "lesson_days_per_week": 4,
  "week_starts_on": "sunday",
  "onboarding_done": true
}
```

Notes:

- **No default zones.** They start as `null`. The app will not run goal features until you set them.
- Zones are plain ranges, with no word like "male" or "female" and no assumed direction. The target can be above or below the start.
- **The ramped zone** (what you see on the practice graph) is worked out on the phone: each edge of the shown zone is the start edge plus `ramp_percent` of the way to the matching target edge. At 25%, a start of 165 to 200 and a target of 190 to 230 give 171 to 207.5. A pure, tested function, so it is the same everywhere.
- The server checks values are sane (ramp 0 to 100, caps within sensible bounds, ranges with lo below hi) but does not decide what is safe for you. The "ramp only goes up when the user raises it" rule is enforced in the app.

### Migrations

- Numbered SQL files in `server/migrations/`, built into the program.
- Forward only. Run automatically at start-up inside a transaction.
- **Before any migration runs, the program takes a snapshot of the database** (`data/backups/pre-migration-N.db`). A bad migration can always be undone by hand.
- A test builds a fresh database and upgrades an old one (see `docs/testing.md`).

## 3. File formats

### Audio

- WAV, mono, 16-bit, **16 kHz** (one constant in the code, so it can be raised later).
- Stored exactly as the phone sends it, after the server checks the header: correct format, rate, channel count, and length matching the size.
- The audio is the master copy. Nothing else is needed to rebuild analysis.

### Series file (`.wbs.gz`)

A compact record of every analysis frame (one every 20 ms), so charts open instantly without re-analysing audio.

```
Gzip of:
  magic "WBS1"              4 bytes
  header length             4 bytes (little-endian)
  header                    JSON: { "version": 1, "hop_ms": 20, "frames": 90000,
                                    "fields": ["f0","clarity","rms","f1","f2","f3"],
                                    "analysis_version": 1 }
  data                      one block per field, in order,
                            each "frames" float32 values (little-endian)
```

- **Raw values are stored.** The smoothing seen on screen is applied when drawing.
- A missing value (for example no confident pitch in a frame) is stored as `NaN`.
- Storing one field after another (not frame by frame) compresses far better.
- 30 minutes is about 90,000 frames, 2 MB before compression and often under 1 MB after.
- The `version` field means the format can change later without breaking old files.

## 4. The API

### Rules for every endpoint

- Under `/api/`. JSON in and out, except audio, series and the export zip.
- Errors always look the same: `{ "error": { "code": "invalid_wav", "message": "The audio file's header is not valid." } }` with the right HTTP status.
- Responses carry `Cache-Control: no-store` (except audio and series, which are cached by fingerprint).
- Every response includes `X-Warbler-API: 1`. If the app on the phone and the program on the potato disagree, the app shows "An update is available, reload" instead of failing oddly.
- Inputs are length-limited and checked. Ids must be valid UUIDs. File paths are always built by the server from ids and never taken from the phone.

### The list

| Method and path | Purpose | Notes |
|---|---|---|
| `GET /api/health` | Is the server alive? | Returns version, database ok, free disk space, data folder writable. Used by the app and by monitoring |
| `GET /api/settings` | Read settings | Includes `version` |
| `PUT /api/settings` | Save settings | Must send the `version` it read. If someone saved in between (phone and Mac both open), it replies `409` and the app reloads. Avoids two devices silently overwriting each other |
| `POST /api/sessions` | Save a finished session | Multipart: `meta.json`, `series.wbs.gz`, `audio.wav`. See Uploads below. Idempotent on id |
| `GET /api/sessions` | List sessions | Filters: `from`, `to` (local dates), `kind`, `tag`. Paged with `limit` and `cursor`. Newest first. Summaries included, no files |
| `GET /api/sessions/:id` | One session's record | Meta, summary, tags, timeline |
| `PATCH /api/sessions/:id` | Edit tags | Only tags are editable. Everything else about a session is a record of what happened |
| `GET /api/sessions/:id/audio` | The recording | Supports `Range`, `ETag` and `Content-Length`, so replay can seek |
| `GET /api/sessions/:id/series` | The series file | Served as-is, gzip. Cached by its fingerprint |
| `PUT /api/sessions/:id/analysis` | Replace series and summary | For re-analysis (see section 6). Sends new series, summary and `analysis_version`. Audio is never changed |
| `DELETE /api/sessions/:id` | Delete a session | Removes files and rows. See Deleting |
| `GET /api/progress?weeks=N` | Weekly figures for charts | Grouped by `local_date` and your week-start day. Median pitch, spread, minutes, session counts |
| `GET /api/lessons` | Lesson progress | The lessons themselves are part of the app build. This returns completion log and last-done dates |
| `POST /api/lessons/:id/complete` | Log a completion | Takes an id from the phone for idempotency, and an optional `session_id` |
| `GET /api/weekly` | Reports, newest first | Paged |
| `GET /api/weekly/:week_start` | One report | `404` if none yet |
| `PUT /api/weekly/:week_start` | Save a report | The phone's coach computes it (see `docs/coach.md`) and sends it. Idempotent by content. Recomputations link to the old one |
| `GET /api/scenarios` | Call scenarios available | Names, difficulty, which audio is present |
| `GET /api/scenarios/:id/audio/:file` | A call audio file | `Range` supported |
| `GET /api/export` | Everything as a zip | See Export |
| `POST /api/import` | Restore from an export | Idempotent by id. Never overwrites an existing different session; reports conflicts |

Two small additions beyond the original plan: `PATCH` for tags (the feel tags can be changed afterwards) and `/api/scenarios` (call simulator).

### Uploads (the careful part)

The upload is the one place data can be lost or doubled, so it is handled strictly.

**Phone side** (`web/src/lib/upload/`):

1. At the end of a session, the phone builds the audio, series and meta, computes fingerprints, and **first saves them in the phone's own storage** (IndexedDB) in a "pending" state. The "not saved yet" screen is showing from this moment.
2. It sends the upload.
3. Only when the server answers success **and** its fingerprints match are the pending copies deleted and the screen changes to "saved".
4. On failure it retries with growing delays (for example 2 s, 5 s, 15 s, 1 min, then every few minutes) while the app is open, and again at every launch.
5. It asks the browser to protect that storage from being cleared (`navigator.storage.persist()`).

**Server side:**

1. Reads the upload under a size limit (about 100 MB) and a time limit that tolerates slow phone connections.
2. Writes the files into `tmp/`, computing fingerprints as it goes.
3. Checks the WAV header, the series header, the meta, and the fingerprints in `meta.json`.
4. If this id already exists: same fingerprints means it replies `200` with the existing record (a harmless repeat). Different fingerprints means `409`, and nothing is overwritten.
5. Otherwise: moves the files into place, **then** writes the database record in one transaction. A crash between those steps leaves at worst a stray file, not a half-saved session.
6. Replies `201` with the saved record.
7. At start-up the program sweeps `tmp/` and finds stray files with no matching record.

**Open check:** iOS can clear a website's stored data when it is unused for a while. Installed home-screen apps are believed to be treated more kindly, but I have not confirmed this. It is added to the Phase 0 checklist and to Phase 5's testing, because it decides how much we can trust the "keep it on the phone until saved" safety net.

### Deleting

Deleting removes the session's database rows, tags, audio and series files, in that order of safety: files are removed after the database commit succeeds, and anything left behind is picked up by the start-up sweep. If the session was used for a weekly report, the report keeps its numbers but loses its "listen" link and says so.

The confirm dialog on the phone says "This cannot be undone". See "Decisions for you" for an optional undo window.

### Export and import

`GET /api/export` streams a zip (it is built as it is sent, so memory stays small):

```
warbler-export-2026-10-29.zip
├── manifest.json        version, counts, fingerprint of every file
├── warbler.db           a clean snapshot made with SQLite's safe copy (not a raw file copy of a live database)
├── sessions/{id}/meta.json, audio.wav, series.wbs.gz
└── scenarios/           the call audio
```

`POST /api/import` reads the same zip and adds anything missing, by id and fingerprint. It is tested by exporting, wiping a test server, importing, and comparing. This is also the heart of the Phase 8 restore test.

## 5. Security and privacy

Warbler has no log-in by design. Safety rests on layers:

1. **The network.** The container's port is published to the potato's own localhost only. The only way in is `tailscale serve`, which only your tailnet can reach.
2. **Host check.** The server refuses requests whose `Host` header is not the app's own Tailscale name or localhost. This blocks a nasty trick (DNS rebinding) where a malicious web page tricks a browser into talking to a private server.
3. **Same-origin only.** No CORS headers, so another website cannot call the API from a browser.
4. **No outside content.** A strict content policy (`default-src 'self'`) means the page can load only its own files. Fonts and icons are bundled. This is also tested.
5. **Optional extra lock.** `tailscale serve` can add headers naming the signed-in Tailscale user. The server can require that header, which also proves the request came through Tailscale and not from some other process on the potato. See decisions.
6. **Container hardening.** Non-root user, read-only filesystem except `/data`, no extra permissions.
7. **Logs.** Only method, path with ids, status, timing. Never audio, never settings, never tag names. Logs rotate (Phase 8).
8. **No telemetry, no accounts, no cookies.**
9. **Secrets.** The app has none. The call-simulator service key exists only on your Mac.

What this does **not** protect against: someone who has your unlocked phone, or access to the potato itself. Those are outside what an app can fix. The export contains all your recordings, so keep exported zips as private as the originals.

## 6. Re-analysis (why we keep the audio)

Analysis will improve (Phase 4 formants, bug fixes, a changed formant ceiling). Because the audio is kept:

- Each session stores the `analysis_version` it was made with.
- The app can offer "Update older sessions". It downloads each recording, runs the current analysis on the phone, and sends the result with `PUT /api/sessions/:id/analysis`. The old series and summary are replaced, and the weekly reports that used them are recomputed as new rows.
- This runs only when you ask, with a progress bar, and never touches the audio.

## 7. Health and integrity

- `GET /api/health` reports free disk space and warns early (for example below 10 GB).
- A command `warbler verify` (run inside the container) walks all records and files: missing files, strays, fingerprints that no longer match, and database integrity. It can be run before and after backups and restores.
- Nightly backups (Phase 8) use SQLite's safe snapshot, not copying a live file.

## Decisions for you

1. **Undo window for deleting.** Right now a delete is permanent. Option: deleted sessions go to a hidden "Recently deleted" for 14 days before being removed for good. Safer against accidents; costs a little disk and one more screen. This is a trade between "delete means gone" and "oops-proof". My lean is to include it, with an "Empty now" button.
2. **Default ramp.** The plan says conservative. I used 25%. You can change it in Settings. Is 25% a fair starting suggestion?
3. **Tailscale-user lock** (item 5 in the security section). Adds a second check that only your Tailscale identity can use the API. Small to build; slight chance of annoyance if you ever share the tailnet with someone. I lean yes.
4. **Import/export now or later.** I put import in Phase 3 with export. It is not strictly needed until Phase 8's restore test, but building both together is cheaper. Okay?
