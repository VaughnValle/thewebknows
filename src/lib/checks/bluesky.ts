import { getWithRetry, readJson } from './http';
import { cleanText, textLooksLikeContact, textLooksLikeLink } from './sanitize';
import { formatClock, formatYear } from '../format';
import { defaultDeps, type ApiObservation, type CheckDeps, type CheckResult } from './types';

/** Bluesky's documented public (unauthenticated) AppView host. */
export const BLUESKY_API = 'https://public.api.bsky.app';

export class BlueskyRateGuard {
  blockedUntilMs: number | null = null;
  requestsThisSession = 0;

  constructor(readonly sessionCap = 12) {}

  blockedUntil(now: number): number | null {
    return this.blockedUntilMs !== null && now < this.blockedUntilMs ? this.blockedUntilMs : null;
  }

  noteRateLimited(headers: Headers, now: number): number {
    const reset = Number(headers.get('ratelimit-reset'));
    const retryAfter = Number(headers.get('retry-after'));
    let until = now + 60_000;
    if (reset && !Number.isNaN(reset)) until = reset * 1000;
    else if (retryAfter && !Number.isNaN(retryAfter)) until = now + retryAfter * 1000;
    this.blockedUntilMs = until;
    return until;
  }
}

interface BlueskyProfile {
  handle?: unknown;
  displayName?: unknown;
  description?: unknown;
  postsCount?: unknown;
  followersCount?: unknown;
  createdAt?: unknown;
  labels?: unknown;
}

function hasNoUnauthenticatedLabel(labels: unknown): boolean {
  return Array.isArray(labels) && labels.some((l) => l && typeof l === 'object' && (l as { val?: unknown }).val === '!no-unauthenticated');
}

export function summarizeBlueskyProfile(p: BlueskyProfile, requested: string) {
  const handle = cleanText(p.handle, 253) ?? requested;
  const optedOutOfLoggedOut = hasNoUnauthenticatedLabel(p.labels);
  const displayName = cleanText(p.displayName, 120);
  const bio = cleanText(p.description);

  const observations: ApiObservation[] = [];
  if (displayName) observations.push({ category: 'name', label: 'Display name', value: displayName });
  if (bio) observations.push({ category: 'bio', label: 'Bio', value: bio });
  if (bio && textLooksLikeContact(bio)) observations.push({ category: 'contact', label: 'Bio may contain contact details', value: bio });
  if (bio && textLooksLikeLink(bio)) observations.push({ category: 'linked', label: 'Bio may contain a link', value: bio });

  const facts: string[] = [];
  if (typeof p.postsCount === 'number') facts.push(`${p.postsCount} posts`);
  if (typeof p.followersCount === 'number') facts.push(`${p.followersCount} followers`);
  const year = formatYear(p.createdAt);
  if (year) facts.push(`Joined ${year}`);

  const notes = [
    "Bluesky has no private profiles: posts, likes and follows are public by design.",
  ];
  if (optedOutOfLoggedOut) {
    notes.unshift(
      'This account asks apps not to show it to logged-out visitors. The API still returns it, and apps may or may not honor the request.',
    );
  }
  return { profile: { handle, displayName, bio, facts, notes }, observations };
}

export async function checkBluesky(
  handle: string,
  guard: BlueskyRateGuard,
  deps: CheckDeps = defaultDeps(),
): Promise<CheckResult> {
  const now = deps.now();
  const blocked = guard.blockedUntil(now);
  if (blocked !== null) {
    return {
      status: 'unable',
      checkedAt: now,
      reason: 'rate-limited',
      retryAt: blocked,
      detail: `Bluesky asked us to slow down. Try again around ${formatClock(blocked)}.`,
    };
  }
  if (guard.requestsThisSession >= guard.sessionCap) {
    return {
      status: 'unable',
      checkedAt: now,
      reason: 'rate-limited',
      detail: 'This session has reached its limit for automatic Bluesky checks. Open the link to check it yourself.',
    };
  }

  guard.requestsThisSession++;
  const outcome = await getWithRetry(
    `${BLUESKY_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
    { Accept: 'application/json' },
    deps,
  );
  const checkedAt = deps.now();

  if (outcome.kind === 'timeout') {
    return { status: 'unable', checkedAt, reason: 'timeout', detail: 'Bluesky took too long to answer.' };
  }
  if (outcome.kind === 'network') {
    return {
      status: 'unable',
      checkedAt,
      reason: 'network',
      detail: "Couldn't reach Bluesky. You may be offline, or a browser extension or network may be blocking it.",
    };
  }

  const res = outcome.response;
  if (res.ok) {
    const body = (await readJson(res)) as BlueskyProfile | null;
    if (!body || typeof body !== 'object') {
      return { status: 'unable', checkedAt, reason: 'server', detail: 'Bluesky sent a response we could not read.' };
    }
    return { status: 'api-returned', checkedAt, ...summarizeBlueskyProfile(body, handle) };
  }

  if (res.status === 429) {
    const retryAt = guard.noteRateLimited(res.headers, checkedAt);
    return {
      status: 'unable',
      checkedAt,
      reason: 'rate-limited',
      retryAt,
      detail: `Bluesky asked us to slow down. Try again around ${formatClock(retryAt)}.`,
    };
  }

  if (res.status === 400) {
    const body = (await readJson(res)) as { error?: unknown; message?: unknown } | null;
    const error = typeof body?.error === 'string' ? body.error : '';
    const message = typeof body?.message === 'string' ? body.message : '';
    if (error === 'AccountDeactivated' || error === 'AccountTakedown') {
      return {
        status: 'not-found',
        checkedAt,
        detail: `Bluesky reports the account “${handle}” is deactivated or unavailable, so no profile was returned.`,
      };
    }
    if (/not found|unable to resolve|could not find/i.test(message)) {
      return { status: 'not-found', checkedAt, detail: `Bluesky's public API didn't return a profile for “${handle}”.` };
    }
    return { status: 'unable', checkedAt, reason: 'invalid-handle', detail: 'Bluesky could not look up this handle.' };
  }
  if (res.status === 401 || res.status === 403) {
    return { status: 'unable', checkedAt, reason: 'blocked', detail: 'Bluesky declined this request.' };
  }
  return { status: 'unable', checkedAt, reason: 'server', detail: `Bluesky had a problem answering (status ${res.status}).` };
}
