/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production Content-Security-Policy. The app talks to exactly two third-party
 * origins (the supported public APIs) and loads nothing else remotely: no
 * analytics, no remote fonts, no remote avatars.
 * Dev mode is excluded because Vite's HMR preamble uses inline scripts.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  'connect-src https://api.github.com https://public.api.bsky.app',
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
];

/** frame-ancestors only works as an HTTP header, so it's added to _headers but not the meta tag. */
const CSP_META = CSP_DIRECTIVES.join('; ');
const CSP_HEADER = [...CSP_DIRECTIVES, "frame-ancestors 'none'", 'upgrade-insecure-requests'].join('; ');

/**
 * Cloudflare Pages `_headers` file. Same policy as the meta tag, plus headers
 * a static host can only send over HTTP.
 */
const HEADERS_FILE = `/*
  Content-Security-Policy: ${CSP_HEADER}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

function securityPlugin(): Plugin {
  return {
    name: 'twk-security',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS_FILE });
    },
  };
}

export default defineConfig({
  plugins: [react(), securityPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
