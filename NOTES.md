# Notes

Findings, test results and open questions, in the order they are learned. Each entry has a date. Anything uncertain (phone behaviour, library licences, accuracy) goes here, then gets surfaced to Autumn.

## Phase 0

### Setup facts

- Port 8892 and folder `~/Warbler`: confirmed free on the potato on 2026-10-30. Ports already listening there: 22 53 80 443 5335 8080 8081 8418 8766 8888 8890 8891 8899 11434.
- `lucide-svelte` is deprecated by its author in favour of `@lucide/svelte` (same icon set, same repository). The project uses `@lucide/svelte`.
- The SvelteKit scaffold in use (SvelteKit 3, Vite 8) keeps the adapter in `vite.config.ts` rather than `svelte.config.js`, and uses `#lib` subpath imports which cannot resolve TypeScript files without extensions. The project uses plain relative imports.
- `cookie` is declared as a dev dependency of `web/` because SvelteKit's post-build step imports it, and with pnpm's strict layout a copy higher up the folder tree (found at `~/node_modules/cookie`, an old CommonJS version) was being picked up instead.
- The GHCR package became public on its own (it inherits the public repository's visibility), so no manual step was needed.
- GitHub Actions warns that `actions/checkout@v4` and friends run on Node 20 (deprecated). They still work. Bump to newer majors when convenient.
- Existing unit `her-go.service` on the potato has `StartLimitIntervalSec` under `[Service]` (it belongs under `[Unit]`), so systemd ignores it and says so whenever units are verified. Not Warbler's, harmless, left alone; worth fixing separately.
- Licence: MIT, chosen by Autumn on 2026-10-30 (`LICENSE`).
- SSH to the potato: the working aliases are `potato-remote` (over Tailscale) and `potato` (home network only). The agent's first attempt used the wrong name (`lepotato`), which is why it saw a host-key error. The potato has passwordless sudo, Docker 29.6 with Compose v5.3, systemd 257, flock, Tailscale 1.104.

### Phone test results ([HUMAN], see docs/phase-0.md, section F)

| # | Question | Result |
|---|---|---|
| 1 | Page loads in Safari | |
| 2 | Mic prompt appears, meter moves | |
| 3 | Add to Home Screen works | |
| 4 | Mic permission asked again in installed app? | |
| 5 | Asked again after fully closing and reopening? | |
| 6 | After locking the phone 30 seconds | |
| 7 | After switching to another app and back | |
| 8 | Sample rate shown | |
| 9 | Stored test note still there after a few days? | |

### Identity header

- **Yes.** `Tailscale-User-Login` arrives through `tailscale serve` (Tailscale 1.104.2 on the potato) and carries the login name. Verified 2026-10-30 from the Mac with `curl https://lepotato.taild95077.ts.net:8892/api/whoami` while the lock was in `log` mode. The lock is now `enforce`, restricted to that login.
- Lock behaviour verified on the potato: through serve allowed; direct to `127.0.0.1:8892` with no header 403; wrong login 403; `/healthz` 200.

### Update path

| Check | Result |
|---|---|
| First image published to GHCR (`r26.4e14c5f`, amd64 and arm64), anonymous lookup works | Done. Verified by the agent, 2026-10-30 |
| Update from Settings works end to end | Done 2026-10-30, driven through the app's own endpoints over Tailscale: `r28.6071538` to `r29.9fbf7e3` in 22 seconds, result ok. Other services untouched |
| Update from Meridian works end to end | Waiting. Pull request AutumnsGrove/Meridian#8 (not merged) adds the example config and docs; the root-owned `/etc/meridian/targets.json` and `observe.json` on the potato still need the entry, applied by Autumn |
| Deliberately broken build rolled back | First run 2026-10-30: rolled back correctly in about 23 seconds, Warbler stayed up on `r29.9fbf7e3`. **Found a bug**: the failure message contained a tab from Docker's log output, which made the result file invalid JSON, so the app showed "no result" instead of "failed". Fixed three ways (watcher escaping, app treats unreadable result as a failure, UI gives up waiting after 90s) with regression tests. Re-run after the fix, same day: rolled back in 24 seconds and the app's status endpoint showed `failed` with the readable reason; the test channel was then removed and Warbler updated normally to `r30.2db0556` |

### Meridian pull request

- AutumnsGrove/Meridian#8, opened 2026-10-30, **not merged** (Autumn wants to see the automated reviewer). `scripts/check all` green locally, including fuzzing, gitleaks and govulncheck. The reviewer workflow ran in full (Pi through OpenRouter, 2m35s, every step succeeded) and posted no comment, meaning it found nothing to flag. Its gate skips only PRs where every changed file is under `docs/`, `mockups/` or is a `.md`; this PR also changes `examples/*.yaml` and `.json`, so it was reviewed.

### Things to know

- The potato's checkout (`~/Warbler`) only changes when someone runs `git pull` there. Updates replace the image, not the compose file, the watcher script or the units. See "What does not update itself" in `docs/update.md`.
