import { getWithRetry, readJson } from './http';
import { cleanText, textLooksLikeContact, textLooksLikeLink } from './sanitize';
import { formatClock, formatYear } from '../format';
import { defaultDeps, type ApiObservation, type CheckDeps, type CheckResult } from './types';

export const GITHUB_API = 'https://api.github.com';

/**
 * Tracks GitHub's unauthenticated quota (60 requests/hour per IP) from the
 * X-RateLimit-* headers, so we stop asking once it's spent instead of
 * burning requests that will certainly fail. Also enforces a small per-session
 * cap so one visitor can't exhaust a shared IP's quota.
 */
export class GitHubRateGuard {
  remaining: number | null = null;
  resetAt: number | null = null;
  requestsThisSession = 0;

  constructor(readonly sessionCap = 12) {}

  blockedUntil(now: number): number | null {
    if (this.remaining === 0 && this.resetAt !== null && now < this.resetAt) return this.resetAt;
    return null;
  }

  update(headers: Headers, now: number) {
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const retryAfter = headers.get('retry-after');
    if (remaining !== null && remaining !== '' && !Number.isNaN(Number(remaining))) this.remaining = Number(remaining);
    if (reset !== null && reset !== '' && !Number.isNaN(Number(reset))) this.resetAt = Number(reset) * 1000;
    if (retryAfter !== null && !Number.isNaN(Number(retryAfter))) {
      this.remaining = 0;
      this.resetAt = now + Number(retryAfter) * 1000;
    }
  }
}

interface GitHubUser {
  login?: unknown;
  name?: unknown;
  bio?: unknown;
  company?: unknown;
  location?: unknown;
  email?: unknown;
  blog?: unknown;
  twitter_username?: unknown;
  public_repos?: unknown;
  created_at?: unknown;
  type?: unknown;
}

export function summarizeGitHubUser(user: GitHubUser, requested: string) {
  const handle = cleanText(user.login, 39) ?? requested;
  const name = cleanText(user.name, 120);
  const bio = cleanText(user.bio);
  const company = cleanText(user.company, 120);
  const location = cleanText(user.location, 120);
  const email = cleanText(user.email, 120);
  const blog = cleanText(user.blog, 200);
  const twitter = cleanText(user.twitter_username, 30);

  const observations: ApiObservation[] = [];
  if (name) observations.push({ category: 'name', label: 'Name', value: name });
  if (bio) observations.push({ category: 'bio', label: 'Bio', value: bio });
  if (company) observations.push({ category: 'affiliation', label: 'Company', value: company });
  if (location) observations.push({ category: 'affiliation', label: 'Location', value: location });
  if (email) observations.push({ category: 'contact', label: 'Public email', value: email });
  if (!email && bio && textLooksLikeContact(bio)) {
    observations.push({ category: 'contact', label: 'Bio may contain contact details', value: bio });
  }
  if (blog) observations.push({ category: 'linked', label: 'Website', value: blog });
  if (twitter) observations.push({ category: 'linked', label: 'Linked X account', value: `@${twitter}` });
  if (!blog && !twitter && bio && textLooksLikeLink(bio)) {
    observations.push({ category: 'linked', label: 'Bio may contain a link', value: bio });
  }

  const facts: string[] = [];
  if (user.type === 'Organization') facts.push('Organization account');
  if (typeof user.public_repos === 'number') facts.push(`${user.public_repos} public repositories`);
  const year = formatYear(user.created_at);
  if (year) facts.push(`Joined ${year}`);

  return {
    profile: {
      handle,
      displayName: name,
      bio,
      facts,
      notes: [
        "This is what GitHub's public API returns. The profile page itself may show more, such as pinned repositories, contributions and commit email addresses.",
      ],
    },
    observations,
  };
}

export async function checkGitHub(
  username: string,
  guard: GitHubRateGuard,
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
      detail: `GitHub's hourly limit for public lookups from your network is used up. It resets around ${formatClock(blocked)}.`,
    };
  }
  if (guard.requestsThisSession >= guard.sessionCap) {
    return {
      status: 'unable',
      checkedAt: now,
      reason: 'rate-limited',
      detail: 'This session has reached its limit for automatic GitHub checks. Open the link to check it yourself.',
    };
  }

  guard.requestsThisSession++;
  const outcome = await getWithRetry(
    `${GITHUB_API}/users/${encodeURIComponent(username)}`,
    { Accept: 'application/vnd.github+json' },
    deps,
  );
  const checkedAt = deps.now();

  if (outcome.kind === 'timeout') {
    return { status: 'unable', checkedAt, reason: 'timeout', detail: 'GitHub took too long to answer.' };
  }
  if (outcome.kind === 'network') {
    return {
      status: 'unable',
      checkedAt,
      reason: 'network',
      detail: "Couldn't reach GitHub. You may be offline, or a browser extension or network may be blocking it.",
    };
  }

  const res = outcome.response;
  guard.update(res.headers, checkedAt);

  if (res.ok) {
    const body = (await readJson(res)) as GitHubUser | null;
    if (!body || typeof body !== 'object') {
      return { status: 'unable', checkedAt, reason: 'server', detail: 'GitHub sent a response we could not read.' };
    }
    return { status: 'api-returned', checkedAt, ...summarizeGitHubUser(body, username) };
  }

  if (res.status === 404) {
    return { status: 'not-found', checkedAt, detail: `GitHub's public API didn't return an account for “${username}”.` };
  }

  if (res.status === 429 || (res.status === 403 && guard.remaining === 0)) {
    const retryAt = guard.resetAt ?? undefined;
    return {
      status: 'unable',
      checkedAt,
      reason: 'rate-limited',
      retryAt,
      detail: retryAt
        ? `GitHub's hourly limit for public lookups from your network is used up. It resets around ${formatClock(retryAt)}.`
        : "GitHub's limit for public lookups from your network is used up for now.",
    };
  }
  if (res.status === 403 || res.status === 451) {
    return { status: 'unable', checkedAt, reason: 'blocked', detail: 'GitHub declined this request.' };
  }
  if (res.status === 422 || res.status === 400) {
    return { status: 'unable', checkedAt, reason: 'invalid-handle', detail: 'GitHub could not look up this username.' };
  }
  return { status: 'unable', checkedAt, reason: 'server', detail: `GitHub had a problem answering (status ${res.status}).` };
}
