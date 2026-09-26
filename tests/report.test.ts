import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../src/lib/platforms/candidates';
import { initialState, reducer, type Action, type SessionState } from '../src/lib/session/state';
import { fieldRows } from '../src/lib/report/provenance';
import { counts, displayRetrieval, nextFixes, usernameReuse } from '../src/lib/report/summary';
import { buildExport, exportAsText, DEFAULT_EXPORT_OPTIONS } from '../src/lib/report/export';
import { summarizeGitHubUser } from '../src/lib/checks/github';
import { githubUser } from './fixtures/github';
import type { PlatformId } from '../src/lib/types';

function session(platforms: PlatformId[], usernames = ['janedoedev'], actions: Action[] = []): SessionState {
  let s = initialState();
  const set = generateCandidates({ usernames, links: [], displayName: '', platforms });
  s = reducer(s, { type: 'startRun', set, now: 0 });
  for (const a of actions) s = reducer(s, a);
  return s;
}

const ghId = 'github:api:janedoedev';
const igId = 'instagram:profile:janedoedev';
const apiReturned: Action = {
  type: 'lookupFinished',
  id: ghId,
  result: { status: 'api-returned', checkedAt: 1, ...summarizeGitHubUser(githubUser, 'janedoedev') },
};

describe('retrieval vs identity', () => {
  it('a generated link is a candidate until the user reviews it — never "found"', () => {
    const s = session(['instagram']);
    const c = s.run!.candidates[0];
    expect(displayRetrieval(c, s)).toBe('candidate');
    expect(counts(s).confirmed).toBe(0);
    const s2 = reducer(s, { type: 'identity', id: c.id, value: 'unsure' });
    expect(displayRetrieval(c, s2)).toBe('user-reviewed');
    expect(counts(s2).confirmed).toBe(0);
  });

  it('an API result is not counted as yours until you say so', () => {
    const s = session(['github'], undefined, [apiReturned]);
    expect(displayRetrieval(s.run!.candidates[0], s)).toBe('api-returned');
    expect(counts(s).confirmed).toBe(0);
    expect(counts(s).awaiting).toBe(1);
  });

  it('not-found API results are excluded from review counts and clear prior answers', () => {
    const s = session(['github'], undefined, [
      { type: 'identity', id: ghId, value: 'mine' },
      { type: 'lookupFinished', id: ghId, result: { status: 'not-found', checkedAt: 1, detail: '' } },
    ]);
    expect(counts(s)).toMatchObject({ confirmed: 0, awaiting: 0, apiNotFound: 1 });
  });

  it('unable-to-check keeps the item reviewable by hand', () => {
    const s = session(['github'], undefined, [
      { type: 'lookupFinished', id: ghId, result: { status: 'unable', checkedAt: 1, reason: 'rate-limited', detail: '' } },
    ]);
    const c = s.run!.candidates[0];
    expect(displayRetrieval(c, s)).toBe('unable');
    expect(counts(s)).toMatchObject({ apiUnable: 1, awaiting: 1 });
    const s2 = reducer(s, { type: 'identity', id: c.id, value: 'mine' });
    expect(displayRetrieval(c, s2)).toBe('user-reviewed');
    expect(counts(s2).confirmed).toBe(1);
  });
});

describe('field-level provenance', () => {
  it('uses API data where available, user answers otherwise, and "not checked" by default', () => {
    const s = session(['github', 'instagram'], undefined, [
      apiReturned,
      { type: 'identity', id: ghId, value: 'mine' },
      { type: 'identity', id: igId, value: 'mine' },
      { type: 'checklist', id: igId, question: 'contact', answer: 'yes' },
      { type: 'checklist', id: igId, question: 'name', answer: 'no' },
    ]);
    const gh = Object.fromEntries(fieldRows(s.run!.candidates.find((c) => c.id === ghId)!, s).map((r) => [r.question, r.provenance]));
    expect(gh).toMatchObject({ name: 'api', affiliation: 'api', linked: 'api', contact: 'api', oldPosts: 'not-checked' });

    const ig = Object.fromEntries(fieldRows(s.run!.candidates.find((c) => c.id === igId)!, s).map((r) => [r.question, r.provenance]));
    expect(ig).toEqual({ name: 'user-no', affiliation: 'not-checked', contact: 'user-yes', linked: 'not-checked', oldPosts: 'not-checked' });
  });

  it('flags a conflict when the user says no but the API returned a value', () => {
    const s = session(['github'], undefined, [
      apiReturned,
      { type: 'identity', id: ghId, value: 'mine' },
      { type: 'checklist', id: ghId, question: 'affiliation', answer: 'no' },
    ]);
    const row = fieldRows(s.run!.candidates[0], s).find((r) => r.question === 'affiliation')!;
    expect(row).toMatchObject({ provenance: 'api', conflict: true });
  });
});

describe('next fixes', () => {
  it('returns nothing when nothing is confirmed', () => {
    expect(nextFixes(session(['instagram']))).toEqual([]);
  });

  it('suggests at most three fixes, ranked, based only on real answers', () => {
    const s = session(['instagram', 'x'], ['janedoe'], [
      { type: 'identity', id: 'instagram:profile:janedoe', value: 'mine' },
      { type: 'identity', id: 'x:profile:janedoe', value: 'mine' },
      { type: 'checklist', id: 'instagram:profile:janedoe', question: 'contact', answer: 'yes' },
      { type: 'checklist', id: 'instagram:profile:janedoe', question: 'oldPosts', answer: 'yes' },
      { type: 'checklist', id: 'x:profile:janedoe', question: 'affiliation', answer: 'yes' },
      { type: 'checklist', id: 'x:profile:janedoe', question: 'name', answer: 'yes' },
    ]);
    const fixes = nextFixes(s);
    expect(fixes).toHaveLength(3);
    expect(fixes[0].id).toBe('fix:contact:instagram:profile:janedoe');
    expect(fixes[0].basis).toBe('You marked this public');
    expect(fixes[0].guide?.url).toMatch(/^https:\/\/help\.instagram\.com\//);
  });

  it('re-orders by the stated goal', () => {
    const base: Action[] = [
      { type: 'identity', id: 'instagram:profile:janedoe', value: 'mine' },
      { type: 'checklist', id: 'instagram:profile:janedoe', question: 'affiliation', answer: 'yes' },
      { type: 'checklist', id: 'instagram:profile:janedoe', question: 'oldPosts', answer: 'yes' },
    ];
    const noGoal = session(['instagram'], ['janedoe'], base);
    expect(nextFixes(noGoal)[0].id).toMatch(/^fix:affiliation/);
    const oldPosts = session(['instagram'], ['janedoe'], [...base, { type: 'input', patch: { goal: 'old-posts' } }]);
    expect(nextFixes(oldPosts)[0].id).toMatch(/^fix:oldPosts/);
  });

  it('skips profiles the user chose to keep public', () => {
    const s = session(['instagram'], ['janedoe'], [
      { type: 'identity', id: 'instagram:profile:janedoe', value: 'mine' },
      { type: 'checklist', id: 'instagram:profile:janedoe', question: 'name', answer: 'yes' },
      { type: 'plan', id: 'instagram:profile:janedoe', plan: 'keep' },
    ]);
    expect(nextFixes(s)).toEqual([]);
  });
});

describe('username reuse', () => {
  it('only groups profiles the user confirmed', () => {
    const s = session(['instagram', 'x', 'bluesky'], ['janedoe'], [
      { type: 'identity', id: 'instagram:profile:janedoe', value: 'mine' },
      { type: 'identity', id: 'bluesky:api:janedoe.bsky.social', value: 'mine' },
      { type: 'identity', id: 'x:profile:janedoe', value: 'unsure' },
    ]);
    expect(usernameReuse(s)).toEqual([{ handle: 'janedoe', platforms: ['bluesky', 'instagram'] }]);
  });
});

describe('export', () => {
  const s = session(['github', 'instagram'], undefined, [
    apiReturned,
    { type: 'identity', id: ghId, value: 'mine' },
    { type: 'identity', id: igId, value: 'not-mine' },
  ]);

  it('omits API values and unconfirmed profiles by default', () => {
    const data = buildExport(s, DEFAULT_EXPORT_OPTIONS);
    expect(data.profiles).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('Lisbon');
    expect(JSON.stringify(data)).not.toContain('Jane Doe');
  });

  it('can omit handles entirely', () => {
    const data = buildExport(s, { ...DEFAULT_EXPORT_OPTIONS, includeHandles: false });
    expect(JSON.stringify(data)).not.toContain('janedoedev');
  });

  it('includes values and unconfirmed profiles only when asked', () => {
    const data = buildExport(s, { includeHandles: true, includeApiValues: true, includeUnconfirmed: true });
    expect(data.profiles).toHaveLength(2);
    expect(JSON.stringify(data)).toContain('Lisbon');
  });

  it('produces a readable text checklist', () => {
    const text = exportAsText(s, DEFAULT_EXPORT_OPTIONS);
    expect(text).toContain('THE WEB KNOWS ME');
    expect(text).toContain('GitHub @janedoedev: Mine');
    expect(text).toContain('API-confirmed');
  });
});

describe('clear', () => {
  it('resets everything', () => {
    const s = session(['github'], undefined, [apiReturned, { type: 'identity', id: ghId, value: 'mine' }]);
    expect(reducer(s, { type: 'clear' })).toEqual(initialState());
  });
});
