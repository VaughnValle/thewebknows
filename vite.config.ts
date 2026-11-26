/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production Content-Security-Policy. The app talks to exactly two third-party
 * origins (the supported public APIs) and loads nothing else remotely: no
 * analytics, no remote fonts, no remote avatars.
 * Dev mode is excluded because Vite's HMR preamble uses inline scripts.
 */
function cspDirectives(apiChecks: boolean): string[] {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    // With the API checks off, the page can only talk to its own static files.
    apiChecks ? "connect-src 'self' https://api.github.com https://public.api.bsky.app" : "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
}

/**
 * Cloudflare Pages `_headers` file. Same policy as the meta tag, plus headers
 * a static host can only send over HTTP.
 */
const headersFile = (cspHeader: string) => `/*
  Content-Security-Policy: ${cspHeader}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Link-preview image and app icon may be fetched by other sites and apps.
/og-image.png
  ! Cross-Origin-Resource-Policy
  Cross-Origin-Resource-Policy: cross-origin
  Cache-Control: public, max-age=86400

/apple-touch-icon.png
  ! Cross-Origin-Resource-Policy
  Cross-Origin-Resource-Policy: cross-origin
`;

function securityPlugin(opts: { apiChecks: boolean; staticHost: boolean }): Plugin {
  const directives = cspDirectives(opts.apiChecks);
  /** frame-ancestors only works as an HTTP header, so it's added to _headers but not the meta tag. */
  const meta = directives.join('; ');
  const header = [...directives, "frame-ancestors 'none'", 'upgrade-insecure-requests'].join('; ');
  return {
    name: 'twk-security',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${meta}" />`);
    },
    generateBundle() {
      // GitHub Pages can't send custom headers, so the static build relies on the meta tag alone.
      if (!opts.staticHost) this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile(header) });
    },
  };
}

/**
 * `vite build` is the Cloudflare build. `vite build --mode static` is the build for
 * GitHub Pages or any plain file host: it reads .env.static, uses relative asset
 * paths so it works under any URL, and skips the Cloudflare-only _headers file.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const staticHost = mode === 'static';
  return {
    base: staticHost ? './' : '/',
    plugins: [react(), securityPlugin({ apiChecks: env.VITE_API_CHECKS !== '0', staticHost })],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
