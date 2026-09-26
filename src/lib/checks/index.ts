import { BlueskyRateGuard, checkBluesky } from './bluesky';
import { GitHubRateGuard, checkGitHub } from './github';
import { defaultDeps, type CheckDeps, type CheckResult } from './types';
import type { PlatformId } from '../types';

export type { CheckResult, ApiObservation, ApiProfileSummary, FieldCategory } from './types';

/**
 * Per-session check runner. Holds rate-limit state and an in-memory cache so
 * re-renders or repeated handles never spend extra requests. Created fresh
 * when the session is cleared.
 */
export class CheckService {
  readonly github = new GitHubRateGuard();
  readonly bluesky = new BlueskyRateGuard();
  private cache = new Map<string, Promise<CheckResult>>();

  constructor(private deps: CheckDeps = defaultDeps()) {}

  check(platform: PlatformId, handle: string, { force = false } = {}): Promise<CheckResult> {
    const key = `${platform}:${handle.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached && !force) return cached;
    let p: Promise<CheckResult>;
    if (platform === 'github') p = checkGitHub(handle, this.github, this.deps);
    else if (platform === 'bluesky') p = checkBluesky(handle, this.bluesky, this.deps);
    else throw new Error(`${platform} has no automatic check`);
    this.cache.set(key, p);
    // Don't cache failures: a later retry should really retry.
    p.then((r) => {
      if (r.status === 'unable' && this.cache.get(key) === p) this.cache.delete(key);
    });
    return p;
  }
}
