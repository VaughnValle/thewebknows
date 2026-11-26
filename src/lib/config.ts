/**
 * Build-time switches, read from Vite env variables. The default build
 * (Cloudflare) has both on. See README, "Static build".
 *
 * VITE_NETWORK_LOOKUP=0  No request to the site's own /api/whoami endpoint, so no IP,
 *                        provider or location. Set by `npm run build:static`, because a
 *                        static host has no server code to read the visitor's IP.
 *                        Read directly in src/session/DeviceContext.tsx.
 * VITE_API_CHECKS=0      No username checks against GitHub's and Bluesky's public APIs.
 *                        Every profile becomes a link the visitor opens themselves.
 */

export function apiChecksEnabled(): boolean {
  return import.meta.env.VITE_API_CHECKS !== '0';
}
