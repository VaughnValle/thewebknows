/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production-only Content-Security-Policy. The app talks to exactly two
 * third-party origins (the supported public APIs) and loads nothing else
 * remotely: no analytics, no remote fonts, no remote avatars.
 * Dev mode is excluded because Vite's HMR preamble uses inline scripts.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  'connect-src https://api.github.com https://public.api.bsky.app',
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'twk-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!--CSP-->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
