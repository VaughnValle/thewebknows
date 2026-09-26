import { describe, expect, it } from 'vitest';
import { GitHubRateGuard, checkGitHub } from '../src/lib/checks/github';
import { githubMinimalUser, githubNotFound, githubOrg, githubRateLimited, githubUser, okHeaders, rateLimitHeaders } from './fixtures/github';
import { deps, scriptedFetch } from './fixtures/mockFetch';

const NOW = 1_760_000_000_000;

describe('GitHub adapter', () => {
  it('returns API-confirmed data with field observations', async () => {
    const f = scriptedFetch([{ status: 200, body: githubUser, headers: okHeaders(58) }]);
    const guard = new GitHubRateGuard();
    const r = await checkGitHub('janedoe-dev', guard, deps(f.fetch, NOW));

    expect(r.status).toBe('api-returned');
    if (r.status !== 'api-returned') return;
    expect(r.profile.handle).toBe('janedoe-dev');
    expect(r.profile.displayName).toBe('Jane Doe');
    expect(r.profile.facts).toEqual(['12 public repositories', 'Joined 2019']);
    const cats = r.observations.map((o) => `${o.category}:${o.label}`);
    expect(cats).toContain('name:Name');
    expect(cats).toContain('affiliation:Company');
    expect(cats).toContain('affiliation:Location');
    expect(cats).toContain('linked:Website');
    expect(cats).toContain('linked:Linked X account');
    // No public email field, but the bio contains one.
    expect(cats).toContain('contact:Bio may contain contact details');
    expect(guard.remaining).toBe(58);
  });

  it('requests the right URL without cookies or referrer', async () => {
    const f = scriptedFetch([{ status: 200, body: githubMinimalUser }]);
    await checkGitHub('quiet-coder', new GitHubRateGuard(), deps(f.fetch));
    expect(f.calls[0].url).toBe('https://api.github.com/users/quiet-coder');
    expect(f.calls[0].init?.credentials).toBe('omit');
    expect(f.calls[0].init?.referrerPolicy).toBe('no-referrer');
  });

  it('encodes the username so it cannot change the request path', async () => {
    const f = scriptedFetch([{ status: 404, body: githubNotFound }]);
    await checkGitHub('../orgs/x?y', new GitHubRateGuard(), deps(f.fetch));
    expect(f.calls[0].url).toBe('https://api.github.com/users/..%2Forgs%2Fx%3Fy');
  });

  it('handles a user with no public fields', async () => {
    const f = scriptedFetch([{ status: 200, body: githubMinimalUser }]);
    const r = await checkGitHub('quiet-coder', new GitHubRateGuard(), deps(f.fetch));
    expect(r.status).toBe('api-returned');
    if (r.status === 'api-returned') expect(r.observations).toEqual([]);
  });

  it('notes organization accounts', async () => {
    const f = scriptedFetch([{ status: 200, body: githubOrg }]);
    const r = await checkGitHub('acme-org', new GitHubRateGuard(), deps(f.fetch));
    if (r.status !== 'api-returned') throw new Error('expected api-returned');
    expect(r.profile.facts[0]).toBe('Organization account');
  });

  it('maps 404 to "not found", not to an error', async () => {
    const f = scriptedFetch([{ status: 404, body: githubNotFound, headers: okHeaders(57) }]);
    const r = await checkGitHub('nobody-here', new GitHubRateGuard(), deps(f.fetch));
    expect(r.status).toBe('not-found');
    expect(f.calls).toHaveLength(1); // no retry on 4xx
  });

  it('treats 403 with remaining=0 as rate-limited (unable to check), with reset time', async () => {
    const reset = Math.floor(NOW / 1000) + 1800;
    const f = scriptedFetch([{ status: 403, body: githubRateLimited, headers: rateLimitHeaders(reset) }]);
    const guard = new GitHubRateGuard();
    const r = await checkGitHub('janedoe', guard, deps(f.fetch, NOW));
    expect(r.status).toBe('unable');
    if (r.status !== 'unable') return;
    expect(r.reason).toBe('rate-limited');
    expect(r.retryAt).toBe(reset * 1000);
    expect(f.calls).toHaveLength(1);
  });

  it('stops calling GitHub once the quota is known to be spent', async () => {
    const reset = Math.floor(NOW / 1000) + 1800;
    const f = scriptedFetch([{ status: 403, body: githubRateLimited, headers: rateLimitHeaders(reset) }]);
    const guard = new GitHubRateGuard();
    await checkGitHub('first', guard, deps(f.fetch, NOW));
    const second = await checkGitHub('second', guard, deps(f.fetch, NOW + 1000));
    expect(second.status).toBe('unable');
    if (second.status === 'unable') expect(second.reason).toBe('rate-limited');
    expect(f.calls).toHaveLength(1); // second call short-circuited, no network
  });

  it('resumes after the reset time passes', async () => {
    const reset = Math.floor(NOW / 1000) + 60;
    const f = scriptedFetch([
      { status: 403, body: githubRateLimited, headers: rateLimitHeaders(reset) },
      { status: 200, body: githubMinimalUser, headers: okHeaders(59) },
    ]);
    const guard = new GitHubRateGuard();
    await checkGitHub('a', guard, deps(f.fetch, NOW));
    const later = await checkGitHub('quiet-coder', guard, deps(f.fetch, reset * 1000 + 1));
    expect(later.status).toBe('api-returned');
  });

  it('treats 429 secondary limits with retry-after as rate-limited', async () => {
    const f = scriptedFetch([{ status: 429, body: { message: 'secondary rate limit' }, headers: { 'retry-after': '120' } }]);
    const r = await checkGitHub('janedoe', new GitHubRateGuard(), deps(f.fetch, NOW));
    expect(r).toMatchObject({ status: 'unable', reason: 'rate-limited', retryAt: NOW + 120_000 });
  });

  it('treats other 403s as blocked, not as absence', async () => {
    const f = scriptedFetch([{ status: 403, body: { message: 'Forbidden' }, headers: okHeaders(40) }]);
    const r = await checkGitHub('janedoe', new GitHubRateGuard(), deps(f.fetch));
    expect(r).toMatchObject({ status: 'unable', reason: 'blocked' });
  });

  it('retries a network failure exactly once, then reports unable', async () => {
    const f = scriptedFetch([{ networkError: true }, { networkError: true }]);
    const r = await checkGitHub('janedoe', new GitHubRateGuard(), deps(f.fetch));
    expect(r).toMatchObject({ status: 'unable', reason: 'network' });
    expect(f.calls).toHaveLength(2);
  });

  it('recovers when the single retry succeeds', async () => {
    const f = scriptedFetch([{ status: 502 }, { status: 200, body: githubMinimalUser }]);
    const r = await checkGitHub('quiet-coder', new GitHubRateGuard(), deps(f.fetch));
    expect(r.status).toBe('api-returned');
  });

  it('reports a timeout as unable', async () => {
    const f = scriptedFetch([{ hang: true }, { hang: true }]);
    const r = await checkGitHub('slow', new GitHubRateGuard(), deps(f.fetch, NOW, 5));
    expect(r).toMatchObject({ status: 'unable', reason: 'timeout' });
  });

  it('enforces a per-session request cap', async () => {
    const guard = new GitHubRateGuard(2);
    const f = scriptedFetch([
      { status: 200, body: githubMinimalUser },
      { status: 200, body: githubMinimalUser },
    ]);
    await checkGitHub('a', guard, deps(f.fetch));
    await checkGitHub('b', guard, deps(f.fetch));
    const third = await checkGitHub('c', guard, deps(f.fetch));
    expect(third).toMatchObject({ status: 'unable', reason: 'rate-limited' });
    expect(f.calls).toHaveLength(2);
  });

  it('strips control and bidi-override characters from provider text', async () => {
    const f = scriptedFetch([{ status: 200, body: { ...githubMinimalUser, name: 'Jane‮ eoD\u0007' } }]);
    const r = await checkGitHub('quiet-coder', new GitHubRateGuard(), deps(f.fetch));
    if (r.status !== 'api-returned') throw new Error();
    expect(r.profile.displayName).toBe('Jane eoD');
  });

  it('handles an unreadable body', async () => {
    const bad = (async () => new Response('<html>oops</html>', { status: 200 })) as typeof fetch;
    const r = await checkGitHub('x', new GitHubRateGuard(), deps(bad));
    expect(r).toMatchObject({ status: 'unable', reason: 'server' });
  });
});
