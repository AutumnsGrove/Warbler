# AGENTS.md

Rules for any coding agent working in this repository. `PLAN.md` is the source of truth for what to build, `docs/` holds the detailed designs, and this file is the short version of how to work.

Autumn (who owns this project) uses she/her pronouns. She is new to the technical vocabulary, so explain terms in plain language in docs, in user-facing text, and when you report back.

## Working agreement

1. Work **one phase at a time**. Read the matching `docs/` file first. Commit and push per phase with a clear message. Do not start the next phase until "Done when" is satisfied.
2. Stop and ask at every **[HUMAN]** item. Do not fake phone-test results.
3. Keep scope tight. Do not add features, dependencies, or services that are not in `PLAN.md` without asking.
4. Prefer small, readable functions and a functional core with thin imperative edges. DSP and measures stay pure and tested.
5. No telemetry, no external network calls from the app at runtime, no third-party scripts, fonts or icons loaded from outside. The only allowed outside traffic on the potato is the update watcher fetching a Warbler image on request.
6. Do not invent clinical content. Lessons cite sources and ship as `draft`.
7. Safety rules in `PLAN.md` are requirements. If a task conflicts with them, flag it instead of working around it.
8. When something is uncertain (iOS behaviour, LPC accuracy, library licence), write findings in `NOTES.md` and surface them.
9. Write for a reader new to the technical vocabulary. No emojis anywhere (UI, docs, lessons, commit messages).

## Commands

```bash
make help          # list everything
make dev           # Go API (lock off) + Vite dev server
make test          # every automated test
make test-go       # go vet + go test -race
make test-web      # svelte-check, vitest, build, no-outside-addresses check
make test-watcher  # shellcheck + the update watcher tests
make docker        # build the image locally
```

The web app uses pnpm (`web/`). The server is Go with no outside dependencies. Python is run with `uv` (or plain `python3` for the icon script, which uses only the standard library).

## Where things are

| Path | What |
|---|---|
| `server/` | Go server: `cmd/warbler`, `internal/{api,security,update,config,busy,version}` |
| `web/` | SvelteKit app (static, single page). `web/embed.go` embeds the build into the Go binary |
| `web/content/lessons/` | The 30 drafted lessons (see `docs/lessons.md` for rules) |
| `deploy/` | `install.sh`, `watcher/` (update script, systemd units, tests), `meridian/` snippets |
| `docs/` | Design documents |
| `scripts/` | Repository helper scripts (no-outside-addresses check) |
| `tools/` | `icons/` now; `validate/` and `callsim/` in later phases |

## Things that are easy to get wrong

- **Never commit** recordings, `data/`, `local-recordings/`, generated call audio, `.env`, or API keys.
- The app container never goes online and never names an image to update to. See `docs/update.md`.
- `/healthz` returns only `status` and `version`. Do not add anything to it.
- Lesson text does not repeat stop-and-rest reminders; the app shows one fixed banner. See `docs/lessons.md`.
- The weekly passage text is frozen once the first real recording exists. See `docs/passages.md`.
- Use relative imports in `web/src` (the `$lib` and `#lib` aliases are not set up).
- `web/build/.gitkeep` must stay committed so the Go embed compiles before the web build has run.
