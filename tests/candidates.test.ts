import { describe, expect, it } from 'vitest';
import { generateCandidates, splitUsernamesAndLinks, MAX_USERNAMES } from '../src/lib/platforms/candidates';
import { GUIDES, PLATFORMS } from '../src/lib/platforms/directory';
import { normalizeHandle } from '../src/lib/platforms/handles';
import { parseProfileLink } from '../src/lib/platforms/parseLink';
import { allowlistedUrl, guideUrl } from '../src/lib/platforms/safeUrl';
import { PLATFORM_ORDER } from '../src/lib/types';

const ALL = [...PLATFORM_ORDER];

function assertAllSafe(urls: string[]) {
  const hosts = PLATFORM_ORDER.flatMap((p) => PLATFORMS[p].hosts);
  for (const u of urls) {
    const parsed = new URL(u);
    expect(parsed.protocol).toBe('https:');
    expect(hosts).toContain(parsed.hostname);
  }
}

describe('candidate link generation', () => {
  it('builds direct profile links for valid handles on each platform', () => {
    const set = generateCandidates({ usernames: ['janedoe'], links: [], displayName: '', platforms: ALL });
    const byPlatform = Object.fromEntries(set.candidates.filter((c) => c.kind !== 'search').map((c) => [c.platform, c.url]));
    expect(byPlatform).toEqual({
      github: 'https://github.com/janedoe',
      bluesky: 'https://bsky.app/profile/janedoe.bsky.social',
      instagram: 'https://www.instagram.com/janedoe/',
      tiktok: 'https://www.tiktok.com/@janedoe',
      x: 'https://x.com/janedoe',
      facebook: 'https://www.facebook.com/janedoe',
      linkedin: 'https://www.linkedin.com/in/janedoe/',
      reddit: 'https://www.reddit.com/user/janedoe/',
    });
    assertAllSafe(set.candidates.map((c) => c.url));
  });

  it('marks GitHub and Bluesky as API candidates and the rest as unchecked links', () => {
    const set = generateCandidates({ usernames: ['janedoe'], links: [], displayName: '', platforms: ALL });
    for (const c of set.candidates) {
      if (c.platform === 'github' || c.platform === 'bluesky') expect(c.kind).toBe('api');
      else expect(['profile', 'search']).toContain(c.kind);
    }
  });

  it('gives Facebook and LinkedIn a search shortcut even without a display name', () => {
    const set = generateCandidates({ usernames: ['janedoe'], links: [], displayName: '', platforms: ['facebook', 'linkedin'] });
    const searches = set.candidates.filter((c) => c.kind === 'search');
    expect(searches.map((c) => c.url)).toEqual([
      'https://www.facebook.com/search/people/?q=janedoe',
      'https://www.linkedin.com/search/results/people/?keywords=janedoe',
    ]);
  });

  it('builds search shortcuts from the display name, percent-encoded', () => {
    const set = generateCandidates({ usernames: ['janedoe'], links: [], displayName: 'Jane  Doe & Co', platforms: ['x', 'tiktok'] });
    const searches = set.candidates.filter((c) => c.kind === 'search').map((c) => c.url);
    expect(searches).toContain('https://x.com/search?q=Jane%20Doe%20%26%20Co&f=user');
    expect(searches).toContain('https://www.tiktok.com/search/user?q=Jane%20Doe%20%26%20Co');
    assertAllSafe(searches);
  });

  it('skips platforms where the handle breaks the rules, with a reason', () => {
    const set = generateCandidates({ usernames: ['this_is_a_very_long_name'], links: [], displayName: '', platforms: ['x', 'instagram', 'github'] });
    expect(set.candidates.map((c) => c.platform)).toEqual(['instagram']);
    const skipped = set.skipped.map((s) => s.platform);
    expect(skipped).toContain('x'); // > 15 chars
    expect(skipped).toContain('github'); // underscores not allowed
    expect(set.skipped.find((s) => s.platform === 'x')?.reason).toMatch(/15/);
  });

  it('never emits a URL for injection-style input', () => {
    const nasty = ['javascript:alert(1)', '../../etc', 'a/b', 'evil.com/x', '<script>', 'a?b=c', '%2e%2e', 'jane doe'];
    const { usernames, links } = splitUsernamesAndLinks(nasty.join(','), '');
    const set = generateCandidates({ usernames, links, displayName: '"><img src=x onerror=alert(1)>', platforms: ALL });
    assertAllSafe(set.candidates.map((c) => c.url));
    for (const c of set.candidates) {
      if (c.kind !== 'search') expect(new URL(c.url).pathname).not.toMatch(/\.\.|<|>|\?/);
    }
  });

  it('caps the number of usernames (no bulk lookups)', () => {
    const many = Array.from({ length: 12 }, (_, i) => `user${i}`);
    const set = generateCandidates({ usernames: many, links: [], displayName: '', platforms: ['github'] });
    expect(set.candidates).toHaveLength(MAX_USERNAMES);
  });

  it('de-duplicates, preferring pasted links over username guesses', () => {
    const set = generateCandidates({
      usernames: ['JaneDoe'],
      links: ['https://www.instagram.com/janedoe/'],
      displayName: '',
      platforms: ['instagram'],
    });
    const ig = set.candidates.filter((c) => c.platform === 'instagram');
    expect(ig).toHaveLength(1);
    expect(ig[0].basis).toBe('pasted-link');
  });

  it('adds the platform of a pasted link even if it was not ticked', () => {
    const set = generateCandidates({ usernames: [], links: ['linkedin.com/in/jane-doe-123'], displayName: '', platforms: ['github'] });
    expect(set.platforms).toContain('linkedin');
    expect(set.candidates[0].url).toBe('https://www.linkedin.com/in/jane-doe-123/');
  });

  it('builds DuckDuckGo shortcuts for the wider web', () => {
    const set = generateCandidates({ usernames: ['janedoe'], links: [], displayName: '', platforms: ['github'] });
    expect(set.webSearches[0].url).toBe('https://duckduckgo.com/?q=%22janedoe%22');
  });
});

describe('pasted link parsing', () => {
  const cases: [string, string, string][] = [
    ['https://github.com/octo-cat', 'github', 'octo-cat'],
    ['https://bsky.app/profile/jane.bsky.social', 'bluesky', 'jane.bsky.social'],
    ['https://www.instagram.com/jane.doe/?hl=en', 'instagram', 'jane.doe'],
    ['https://www.tiktok.com/@jane_doe?lang=en', 'tiktok', 'jane_doe'],
    ['https://twitter.com/JaneDoe', 'x', 'JaneDoe'],
    ['x.com/janedoe/status/123', 'x', 'janedoe'],
    ['https://m.facebook.com/profile.php?id=100000123456789', 'facebook', '100000123456789'],
    ['https://www.facebook.com/jane.doe.35', 'facebook', 'jane.doe.35'],
    ['https://www.linkedin.com/in/jane-doe-4b2a1c/', 'linkedin', 'jane-doe-4b2a1c'],
    ['https://old.reddit.com/u/jane_doe', 'reddit', 'jane_doe'],
  ];
  it.each(cases)('%s → %s @%s', (raw, platform, handle) => {
    expect(parseProfileLink(raw)).toMatchObject({ ok: true, platform, handle });
  });

  it.each([
    'https://github.com.evil.example/jane',
    'https://evil.example/instagram.com/jane',
    'https://user:pass@github.com/jane',
    'https://github.com:8443/jane',
    'javascript:alert(1)',
    'ftp://github.com/jane',
    'https://github.com/settings/profile',
    'https://www.instagram.com/p/Cabc123/',
    'https://www.linkedin.com/company/acme',
    'https://www.tiktok.com/foryou',
  ])('rejects %s', (raw) => {
    expect(parseProfileLink(raw).ok).toBe(false);
  });

  it('rebuilds a canonical link rather than reusing the pasted one', () => {
    const set = generateCandidates({ usernames: [], links: ['http://instagram.com/jane.doe/?utm_source=tracker'], displayName: '', platforms: [] });
    expect(set.candidates[0].url).toBe('https://www.instagram.com/jane.doe/');
  });
});

describe('handle normalization', () => {
  it('turns a bare Bluesky name into a bsky.social handle', () => {
    expect(normalizeHandle('bluesky', '@Jane')).toEqual({ ok: true, handle: 'jane.bsky.social' });
    expect(normalizeHandle('bluesky', 'jane.example.com')).toEqual({ ok: true, handle: 'jane.example.com' });
  });
  it('rejects GitHub handles with double hyphens or edge hyphens', () => {
    expect(normalizeHandle('github', '-jane').ok).toBe(false);
    expect(normalizeHandle('github', 'ja--ne').ok).toBe(false);
    expect(normalizeHandle('github', 'ja-ne').ok).toBe(true);
  });
});

describe('URL allowlist', () => {
  it('only accepts https URLs on listed hosts', () => {
    expect(allowlistedUrl('https://github.com/x', ['github.com'])).toBe('https://github.com/x');
    expect(allowlistedUrl('http://github.com/x', ['github.com'])).toBeNull();
    expect(allowlistedUrl('https://github.com.evil.io/x', ['github.com'])).toBeNull();
    expect(allowlistedUrl('https://evil.io@github.com/x', ['github.com'])).toBeNull();
    expect(allowlistedUrl('javascript:alert(1)', ['github.com'])).toBeNull();
  });

  it('every guide destination is on an allowlisted official host and has a review date', () => {
    for (const p of PLATFORM_ORDER) {
      const g = GUIDES[p];
      expect(g.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const key of ['editProfile', 'privacy', 'oldPosts', 'deletion'] as const) {
        expect(guideUrl(g[key].url), `${p}.${key}`).not.toBeNull();
      }
    }
  });
});

describe('ordering', () => {
  it('orders candidates by platform, profiles before search shortcuts, regardless of input order', () => {
    const set = generateCandidates({
      usernames: ['janedoe'],
      links: ['https://www.linkedin.com/in/jane-doe-4b2a1c/'],
      displayName: 'Jane',
      platforms: ALL,
    });
    const platforms = set.candidates.map((c) => c.platform);
    expect(platforms[0]).toBe('github');
    expect(platforms.indexOf('linkedin')).toBeGreaterThan(platforms.indexOf('facebook'));
    const li = set.candidates.filter((c) => c.platform === 'linkedin').map((c) => c.kind);
    expect(li[li.length - 1]).toBe('search');
  });
});
