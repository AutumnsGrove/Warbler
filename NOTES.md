# Notes

Findings, test results and open questions, in the order they are learned. Each entry has a date. Anything uncertain (phone behaviour, library licences, accuracy) goes here, then gets surfaced to Autumn.

## Phase 0

### Setup facts

- Port 8892 and folder `~/Warbler` proposed for the potato. **Not yet confirmed free** (SSH from the Mac failed host-key verification when the agent tried, so it could not check). Meridian's docs list 8891, 8899, 8418, 8890, 8888, 8081 as in use.
- `lucide-svelte` is deprecated by its author in favour of `@lucide/svelte` (same icon set, same repository). The project uses `@lucide/svelte`.
- The SvelteKit scaffold in use (SvelteKit 3, Vite 8) keeps the adapter in `vite.config.ts` rather than `svelte.config.js`, and uses `#lib` subpath imports which cannot resolve TypeScript files without extensions. The project uses plain relative imports.
- `cookie` is declared as a dev dependency of `web/` because SvelteKit's post-build step imports it, and with pnpm's strict layout a copy higher up the folder tree (found at `~/node_modules/cookie`, an old CommonJS version) was being picked up instead.
- No licence file has been chosen for the repository. Left for Autumn to decide.

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
| First image published to GHCR, package made public | |
| Update from Settings works end to end | |
| Update from Meridian works end to end | |
| Deliberately broken build rolled back | |
