import { describe, expect, it, vi } from 'vitest';
import worker from '../worker/index';

function env() {
  const assets = vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }));
  return { env: { ASSETS: { fetch: assets } }, assets };
}

const req = (path: string, method = 'GET', cf: Record<string, unknown> = { city: 'Quezon City', country: 'PH', asOrganization: 'PLDT Inc.' }) =>
  Object.assign(new Request(`https://thewebknows.me${path}`, { method, headers: { 'CF-Connecting-IP': '203.0.113.42' } }), { cf });

describe('worker entry', () => {
  it('serves GET /api/whoami as JSON from the request, not from assets', async () => {
    const { env: e, assets } = env();
    const res = await worker.fetch(req('/api/whoami'), e);
    expect(res.headers.get('content-type')).toContain('json');
    expect(await res.json()).toMatchObject({ ip: '203.0.113.42', city: 'Quezon City', isp: 'PLDT Inc.', country: 'PH' });
    expect(assets).not.toHaveBeenCalled();
  });

  it('rejects non-GET on the API with 405', async () => {
    const { env: e } = env();
    expect((await worker.fetch(req('/api/whoami', 'POST'), e)).status).toBe(405);
  });

  it('hands every other path to the static asset store', async () => {
    const { env: e, assets } = env();
    const res = await worker.fetch(req('/'), e);
    expect(assets).toHaveBeenCalledOnce();
    expect(res.headers.get('content-type')).toContain('html');
  });
});
