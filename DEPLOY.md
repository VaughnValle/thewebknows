# Deploying thewebknows.me on Cloudflare Pages

The site is fully static. Cloudflare builds it from GitHub on every push and serves `dist/`, including the generated `_headers` file with the security headers.

## 1. Create the Pages project (one time)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize GitHub if asked and pick **VaughnValle/thewebknows**.
3. Build settings:
   - **Production branch:** `initial-scaffold` (or `main`, if you rename the branch later)
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - The Node version comes from `.node-version` (22). If the build uses an older Node anyway, add the environment variable `NODE_VERSION = 22`.
4. **Save and Deploy**. You'll get a `*.pages.dev` address. Open it and check the site works.

Every push to the production branch redeploys automatically, and other branches get their own preview URLs.

## 2. Connect the domain

Because the domain is registered with Cloudflare, its DNS is already there.

1. In the Pages project → **Custom domains** → **Set up a custom domain** → `thewebknows.me` → **Activate domain**. Cloudflare adds the DNS record for you.
2. Do the same for `www.thewebknows.me`.
3. Send `www` to the bare domain: domain overview → **Rules** → **Redirect Rules** → **Create rule** → template **Redirect from WWW to root** → Deploy.
4. **SSL/TLS** → **Edge Certificates** → turn on **Always Use HTTPS**.

Certificates can take a few minutes to issue.

## Workers + Static Assets, and the `/api/whoami` endpoint

This project deploys as a **Cloudflare Worker with static assets** (not Pages). The committed `wrangler.jsonc` points at the Worker entry `worker/index.ts` and serves the built site from `dist/`:

- Static files are served straight from the asset store, with the security headers from `dist/_headers`.
- The Worker runs only for non-asset requests. It answers `GET /api/whoami`, echoing back what Cloudflare already sees about the visitor's own request (IP, network operator, approximate location). It doesn't log or store anything, and the response is marked `no-store`. Everything else is handed to the asset store (`env.ASSETS`), which applies the single-page-app fallback.

Build settings in the Cloudflare dashboard:
- **Build command:** `npm run build`  → produces `dist/`
- **Deploy command:** `npx wrangler deploy` → bundles the Worker and uploads `dist/` using `wrangler.jsonc`

To keep the privacy promise, leave **Observability / Workers Logs** off for the Worker (or turn it off again after any debugging). Usage is covered by the free plan: one small request per visit.

> The old Pages-style `functions/` directory is not used by this model and has been removed; the same logic now lives in `worker/whoami.ts`.

## 3. Keep the privacy promises true

The footer says there's no analytics and nothing is collected. Make sure Cloudflare doesn't add anything:

- **Web Analytics:** leave it off, both on the Pages project (Metrics) and under Analytics & Logs → Web Analytics.
- **Rocket Loader** (Speed → Optimization), **Zaraz**, and **Email Address Obfuscation** (Scrape Shield): leave them off. They inject scripts into pages. The site's security policy would block them anyway, and they'd show as console errors.

## 4. Retire the GitHub Pages copy

GitHub repo → **Settings** → **Pages** → unpublish the site, so there's only one public copy. The workflow that deployed it has been removed from the repo.

## 5. Check it

```bash
curl -sI https://thewebknows.me | grep -iE 'content-security|strict-transport|x-frame|referrer'
```

You should see the headers from `dist/_headers`. You can also run the domain through https://securityheaders.com.

## Changing the security headers

Edit `CSP_DIRECTIVES` or `HEADERS_FILE` in `vite.config.ts`. The build writes both the `<meta>` tag and `dist/_headers` from the same definitions, so they can't drift apart.
