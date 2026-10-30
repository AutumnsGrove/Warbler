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

- Does `Tailscale-User-Login` arrive through `tailscale serve`? (Diagnostics, "Server lock")

### Update path

| Check | Result |
|---|---|
| First image published to GHCR (`r26.4e14c5f`, amd64 and arm64), anonymous lookup works | Done. Verified by the agent, 2026-10-30 |
| Update from Settings works end to end | |
| Update from Meridian works end to end | |
| Deliberately broken build rolled back | |
