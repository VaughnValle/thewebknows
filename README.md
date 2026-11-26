# The Web Knows Me — thewebknows.me

**See what the web already knows about you.** Your location, device, browser and public profiles, then what to do about them. No account, no server, nothing saved.

Made by [Vaughn Valle](https://vaughnvalle.com).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # adapter, link-generation, report and UI-flow tests (fixtures only, no network)
npm run build      # static site in dist/ — deploy to any static host
npm run preview
```

## Deploy

Hosted on Cloudflare (Workers + Static Assets) at https://thewebknows.me. Cloudflare builds from GitHub on every push (`npm run build` → `dist/`). The build also writes `dist/_headers` with the security headers. Setup steps are in [DEPLOY.md](DEPLOY.md).

## Static build (GitHub Pages)

`npm run build:static` makes a version with no server code at all, for GitHub Pages or any plain file host. It is the same site with one thing removed: the lookup of the visitor's IP address, internet provider and approximate location, because that needs the `/api/whoami` Worker. The lookup code is left out of the bundle, not just switched off.

Everything else is unchanged, since it all runs in the browser: the device and browser details, the fingerprint, the photo, WebRTC and autofill demos, and the username review.

| | Cloudflare build | Static build |
|---|---|---|
| Command | `npm run build` | `npm run build:static` |
| Server code | One Worker endpoint | None |
| IP, provider, location | Shown | Not looked up |
| Username checks via GitHub and Bluesky APIs | On | On, or off with `VITE_API_CHECKS=0` |
| Security headers | `_headers` file | CSP meta tag only |

- Asset paths are relative, so the build works under any URL: `user.github.io/thewebknows/`, a fork with another name, or a custom domain.
- `.github/workflows/pages.yml` builds and publishes it on every push. Turn it on once under Settings → Pages → Source → GitHub Actions.
- To also turn off the GitHub and Bluesky checks, uncomment `VITE_API_CHECKS=0` in `.env.static`. Every profile then becomes a link the visitor opens themselves, and the CSP narrows to `connect-src 'self'`, so the page can only load its own static files.

## Browser reveal (first screen)

Before anyone types anything, the home page shows what every website can already see:

- **From the browser** (no request leaves the page): browser, OS, languages, time zone, screen, GPU, memory, battery, connection estimates, privacy signals, and a fingerprint hashed locally. Code in `src/lib/device/`.
- **From the connection**: IP address, ISP and approximate location come from our own Cloudflare Worker, `worker/index.ts` (logic in `worker/whoami.ts`), which echoes back what Cloudflare already sees and stores nothing. If it's ever unavailable, the client falls back to Cloudflare's built-in `/cdn-cgi/trace` for IP + country.
- **Photo check**: reads EXIF location, camera and date from a JPEG, and can save a clean copy. Runs entirely in the browser (`src/lib/photo/exif.ts`).
- The summary page adds up to three browser fixes based on what was actually detected.

## How it works

| Platforms | Behavior | What the UI claims |
| --- | --- | --- |
| GitHub, Bluesky | Called from the browser: `api.github.com/users/{u}` and `public.api.bsky.app/xrpc/app.bsky.actor.getProfile` | **API-confirmed**, **Not found by API**, or **Unable to check right now** |
| Instagram, TikTok, X, Reddit | Safe profile links built from valid handles, plus pasted links and search shortcuts | **Open to check**. Never "found" |
| Facebook, LinkedIn | Pasted links are preferred. Also a labeled username guess and a search shortcut | **Open to check** or **Search shortcut** |

Every candidate gets **Mine / Not mine / Unsure** from the user. A profile marked Mine gets an optional yes/no checklist. The checklist never asks for the actual value. The summary shows field-level evidence (**API-confirmed**, **You marked this public**, **You marked this not shown**, **Empty in API data**, **Not checked**), username reuse among confirmed profiles, up to three next fixes, and Keep public / Edit / Review deletion choices that link to official help pages. Anything marked "done" is labeled user-reported.

## Layout

- `src/data/platforms.json`: versioned platform directory (handle rules, allowlisted hosts, link templates, check mode)
- `src/data/guides.json`: official help/settings destinations with last-reviewed dates
- `src/lib/platforms/`: handle validation, link parsing, allowlisted URL building, candidate generation
- `src/lib/checks/`: GitHub and Bluesky adapters (timeouts, one bounded retry, rate-limit guards, per-session caps)
- `src/lib/report/`: provenance, counts, reuse, next-fix rules, export
- `src/lib/session/`: in-memory reducer (the only state store)
- `src/components/`: UI
- `tests/`: fixtures (`tests/fixtures/`) and tests

## Privacy and safety properties

- State lives in React memory only. There is no localStorage, cookie, URL state, analytics or backend. **Clear** resets the state and the check service, including its cache and rate-limit memory.
- Third parties contacted: only GitHub and Bluesky, and only with the handles the user typed. The site's own `/api/whoami` function returns the visitor's connection details to them and keeps nothing. Requests use `credentials: 'omit'` and `no-referrer`. The start page tells the user who receives what.
- Every outbound URL is rebuilt from a template, percent-encoded, and checked against a host allowlist (https only, no userinfo or port). The app never opens or fetches a pasted URL itself. It extracts the handle and rebuilds a canonical link.
- Provider text is rendered as text, with control and bidi-override characters stripped. Remote avatars are not loaded.
- The production build ships a CSP: `connect-src` allows only the two APIs, and there are no remote scripts, fonts or images. Fonts are self-hosted through @fontsource.
- Outbound links use `rel="noopener noreferrer"`, and the page sets `<meta name="referrer" content="no-referrer">`.
- GitHub quota: unauthenticated requests are limited to 60/hour **per IP**. The guard reads `X-RateLimit-*` and `Retry-After`, stops calling once the quota is spent, shows the reset time, and caps each session at 12 checks. Rate limits, timeouts, network errors and 5xx responses always show as "Unable to check", never as "not found". Guided mode keeps working through any of them.

## Before launch

- Click through every link in `src/data/guides.json` in a real browser. They were found on each platform's official help domain on 2026-09-26, but settings pages move. Update `lastReviewed` when you check them.
- Re-check GitHub and Bluesky API terms and quotas.
