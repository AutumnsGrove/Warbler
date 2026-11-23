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
- A stray `~/node_modules` in Autumn's home folder can make local web checks pass when CI fails (it supplied Node types and an old `cookie`). Run `make test-web-clean` before pushing web changes.
- Use relative imports in `web/src` (the `$lib` and `#lib` aliases are not set up).
- `web/build/.gitkeep` must stay committed so the Go embed compiles before the web build has run.

## Pull request reviews

`pi-review` reviews every pull request. It checks out the merge commit, installs, and runs the code, so it
takes minutes rather than seconds. Its check is the **`review / review`** row of `gh pr checks`.

**Do not push while `pi-review` is reading.** The `pi-review` workflow cancels its own superseded run, so a push cancels the review in flight, and a cancelled run has already
read most of the pull request and spent most of what it was going to spend. Pushing to be fast is the
expensive choice, not the cheap one.

Read the `review / review` row and act on the state it reports:

| `review / review` on this head                   | What to do                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| pending                                          | **Wait. Do not push.** A push cancels it and the wait starts over.                                              |
| skipped                                          | A draft, or a branch that is not in this repository. A draft can be marked ready; a fork is never reviewed.      |
| a review for this head                           | Push **once**, with every finding from it. One push per finding restarts the cycle and pays for the read again.  |
| failed, or cancelled by a push that was not yours | It will not post for this head. Say so on the thread, then push.                                               |
| still pending, and it has no start time | The run is queued for a runner, not late. GitHub enforces the 33-minute job timeout itself, so a job that is *running* cannot sit past it — it ends cancelled or failed, which is the row above. A run with no start (`gh run view <id> --json status,startedAt`) is waiting and will start, so wait. |

A green `review / review` tick means a review was posted — the job exits non-zero when it cannot post — so
read the review rather than trusting the tick. A red check from CI is the one exception to all of the
above: fix it and push.
