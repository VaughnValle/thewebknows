import type { UnableReason } from '../types';

/** Field categories the report talks about. */
export type FieldCategory = 'name' | 'bio' | 'affiliation' | 'contact' | 'linked' | 'oldPosts';

/** Something a public API returned, reduced to a category plus a short value. */
export interface ApiObservation {
  category: FieldCategory;
  /** Short human label, e.g. "Location". */
  label: string;
  /** The value as returned (sanitized, truncated). Only shown on screen; export omits it unless asked. */
  value: string;
}

export interface ApiProfileSummary {
  handle: string;
  displayName: string | null;
  bio: string | null;
  /** Short plain-language facts ("Organization account", "Joined 2019"). */
  facts: string[];
  /** Notes about what the API data does and doesn't show. */
  notes: string[];
}

export type CheckResult =
  | { status: 'api-returned'; checkedAt: number; profile: ApiProfileSummary; observations: ApiObservation[] }
  | { status: 'not-found'; checkedAt: number; detail: string }
  | { status: 'unable'; checkedAt: number; reason: UnableReason; detail: string; retryAt?: number };

export interface CheckDeps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
}

export const defaultDeps = (): CheckDeps => ({
  fetch: (...args) => globalThis.fetch(...args),
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs: 8000,
});
