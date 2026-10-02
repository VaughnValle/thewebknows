import { whoamiResponse } from './whoami';

/**
 * Cloudflare Worker entry (Workers + Static Assets).
 *
 * Static files are served straight from the asset store; this Worker only runs
 * for requests that don't match an asset. It answers GET /api/whoami and hands
 * everything else back to the asset store (which applies the SPA fallback).
 */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/whoami') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
      }
      return whoamiResponse(request);
    }
    return env.ASSETS.fetch(request);
  },
};
