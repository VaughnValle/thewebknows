import { describe, expect, it } from 'vitest';
import { BlueskyRateGuard, checkBluesky } from '../src/lib/checks/bluesky';
import {
  blueskyBadRequest,
  blueskyDeactivated,
  blueskyLoggedOutOptOut,
  blueskyNotFound,
  blueskyProfile,
  blueskyRateLimited,
} from './fixtures/bluesky';
import { deps, scriptedFetch } from './fixtures/mockFetch';

const NOW = 1_760_000_000_000;

describe('Bluesky adapter', () => {
  it('returns API-confirmed profile data', async () => {
    const f = scriptedFetch([{ status: 200, body: blueskyProfile }]);
    const r = await checkBluesky('janedoe.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(f.calls[0].url).toBe('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=janedoe.bsky.social');
    expect(r.status).toBe('api-returned');
    if (r.status !== 'api-returned') return;
    expect(r.profile.displayName).toBe('Jane Doe');
    expect(r.profile.facts).toEqual(['845 posts', '210 followers', 'Joined 2023']);
    const cats = r.observations.map((o) => o.category);
    expect(cats).toContain('name');
    expect(cats).toContain('linked'); // a URL in the bio
    expect(cats).not.toContain('contact');
  });

  it('surfaces the logged-out visibility preference', async () => {
    const f = scriptedFetch([{ status: 200, body: blueskyLoggedOutOptOut }]);
    const r = await checkBluesky('private-ish.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    if (r.status !== 'api-returned') throw new Error();
    expect(r.profile.notes[0]).toMatch(/logged-out visitors/);
  });

  it('maps "Profile not found" to not-found', async () => {
    const f = scriptedFetch([{ status: 400, body: blueskyNotFound }]);
    const r = await checkBluesky('nobody.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(r.status).toBe('not-found');
    expect(f.calls).toHaveLength(1);
  });

  it('maps deactivated accounts to not-found with an explanation', async () => {
    const f = scriptedFetch([{ status: 400, body: blueskyDeactivated }]);
    const r = await checkBluesky('gone.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(r.status).toBe('not-found');
    if (r.status === 'not-found') expect(r.detail).toMatch(/deactivated/);
  });

  it('does not treat other 400s as absence', async () => {
    const f = scriptedFetch([{ status: 400, body: blueskyBadRequest }]);
    const r = await checkBluesky('x.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(r).toMatchObject({ status: 'unable', reason: 'invalid-handle' });
  });

  it('handles 429 and then short-circuits until the reset time', async () => {
    const reset = Math.floor(NOW / 1000) + 300;
    const f = scriptedFetch([{ status: 429, body: blueskyRateLimited, headers: { 'ratelimit-reset': String(reset) } }]);
    const guard = new BlueskyRateGuard();
    const first = await checkBluesky('a.bsky.social', guard, deps(f.fetch, NOW));
    expect(first).toMatchObject({ status: 'unable', reason: 'rate-limited', retryAt: reset * 1000 });
    const second = await checkBluesky('b.bsky.social', guard, deps(f.fetch, NOW + 5000));
    expect(second).toMatchObject({ status: 'unable', reason: 'rate-limited' });
    expect(f.calls).toHaveLength(1);
  });

  it('retries a 5xx once, then reports unable (never not-found)', async () => {
    const f = scriptedFetch([{ status: 503 }, { status: 503 }]);
    const r = await checkBluesky('a.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(r).toMatchObject({ status: 'unable', reason: 'server' });
    expect(f.calls).toHaveLength(2);
  });

  it('reports network failure as unable', async () => {
    const f = scriptedFetch([{ networkError: true }, { networkError: true }]);
    const r = await checkBluesky('a.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    expect(r).toMatchObject({ status: 'unable', reason: 'network' });
  });

  it('detects contact-like text in a bio', async () => {
    const f = scriptedFetch([{ status: 200, body: { ...blueskyProfile, description: 'Call me +1 (555) 010-2030' } }]);
    const r = await checkBluesky('janedoe.bsky.social', new BlueskyRateGuard(), deps(f.fetch));
    if (r.status !== 'api-returned') throw new Error();
    expect(r.observations.map((o) => o.category)).toContain('contact');
  });
});
