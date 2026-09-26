export type PlatformId =
  | 'github'
  | 'bluesky'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'reddit';

export const PLATFORM_ORDER: PlatformId[] = [
  'github',
  'bluesky',
  'instagram',
  'tiktok',
  'x',
  'facebook',
  'linkedin',
  'reddit',
];

/** How a platform is checked. Only "api" platforms are ever contacted by this app. */
export type CheckMode = 'api' | 'candidate';

/** Where a candidate came from. */
export type CandidateBasis = 'username' | 'pasted-link' | 'display-name';

/** What kind of link a candidate is. */
export type CandidateKind = 'api' | 'profile' | 'search';

/**
 * Retrieval status — what the app itself knows. Kept separate from identity.
 *  - api-returned:  a supported public API returned a profile for this exact handle
 *  - candidate:     a generated/pasted link the app did not check
 *  - not-found:     the supported API said no profile exists for this handle
 *  - unable:        the check could not run (rate-limited, blocked, offline, error)
 *  - checking:      request in flight
 */
export type RetrievalStatus = 'api-returned' | 'candidate' | 'not-found' | 'unable' | 'checking';

/** Identity status — only ever set by the user. */
export type IdentityStatus = 'mine' | 'not-mine' | 'unsure' | 'awaiting';

export type ChecklistQuestionId = 'name' | 'affiliation' | 'contact' | 'linked' | 'oldPosts';
export type ChecklistAnswer = 'yes' | 'no' | 'skip';

export type PrivacyGoal = 'personal-details' | 'old-posts' | 'professional' | 'curious';

export type UnableReason = 'rate-limited' | 'network' | 'timeout' | 'blocked' | 'server' | 'invalid-handle';
