import { fieldRows, isShown, type FieldRow } from './provenance';
import { GUIDES, platformName, type GuideLink } from '../platforms/directory';
import { guideUrl } from '../platforms/safeUrl';
import type { Candidate } from '../platforms/candidates';
import type { SessionState } from '../session/state';
import type { IdentityStatus, PlatformId, PrivacyGoal } from '../types';

/** Retrieval status as shown in the UI (spec §4), derived from lookups + identity. */
export type DisplayRetrieval = 'api-returned' | 'candidate' | 'user-reviewed' | 'not-found' | 'unable' | 'checking';

export function displayRetrieval(c: Candidate, state: Pick<SessionState, 'lookups' | 'identity'>): DisplayRetrieval {
  if (c.kind === 'api') {
    const l = state.lookups[c.id];
    if (!l || l.status === 'checking') return 'checking';
    if (l.status === 'api-returned') return 'api-returned';
    if (l.status === 'not-found') return 'not-found';
    // Couldn't check automatically: fall back to the user's own review.
    return identityOf(c, state) === 'awaiting' ? 'unable' : 'user-reviewed';
  }
  return identityOf(c, state) === 'awaiting' ? 'candidate' : 'user-reviewed';
}

export function identityOf(c: Candidate, state: Pick<SessionState, 'identity'>): IdentityStatus {
  return state.identity[c.id] ?? 'awaiting';
}

/** Candidates that can be judged. "Not found" API results are excluded. */
export function reviewable(state: SessionState): Candidate[] {
  if (!state.run) return [];
  return state.run.candidates.filter((c) => !(c.kind === 'api' && state.lookups[c.id]?.status === 'not-found'));
}

export function mineCandidates(state: SessionState): Candidate[] {
  return reviewable(state).filter((c) => identityOf(c, state) === 'mine');
}

export interface Counts {
  confirmed: number;
  notMine: number;
  unsure: number;
  awaiting: number;
  apiReturned: number;
  apiNotFound: number;
  apiUnable: number;
  apiChecking: number;
  selectedActions: number;
  actionsDone: number;
}

export function counts(state: SessionState): Counts {
  const items = reviewable(state);
  const api = state.run?.candidates.filter((c) => c.kind === 'api') ?? [];
  const status = (c: Candidate) => state.lookups[c.id]?.status ?? 'checking';
  const mine = new Set(mineCandidates(state).map((c) => c.id));
  return {
    confirmed: mine.size,
    notMine: items.filter((c) => identityOf(c, state) === 'not-mine').length,
    unsure: items.filter((c) => identityOf(c, state) === 'unsure').length,
    // Search shortcuts are optional aids, not possible profiles, so they don't count as "awaiting".
    awaiting: items.filter((c) => c.kind !== 'search' && identityOf(c, state) === 'awaiting').length,
    apiReturned: api.filter((c) => status(c) === 'api-returned').length,
    apiNotFound: api.filter((c) => status(c) === 'not-found').length,
    apiUnable: api.filter((c) => status(c) === 'unable').length,
    apiChecking: api.filter((c) => status(c) === 'checking').length,
    selectedActions: Object.entries(state.plans).filter(([id, p]) => mine.has(id) && p !== 'keep').length,
    actionsDone: Object.keys(state.done).length,
  };
}

/** Handle as a person would compare it across platforms. */
export function comparableHandle(c: Candidate): string | null {
  if (!c.handle) return null;
  let h = c.handle.toLowerCase();
  if (c.platform === 'bluesky') h = h.replace(/\.bsky\.social$/, '');
  if (c.platform === 'facebook' && /^\d+$/.test(h)) return null;
  return h;
}

export interface ReuseGroup {
  handle: string;
  platforms: PlatformId[];
}

/** Handles the user confirmed on 2+ platforms. Only confirmed profiles count. */
export function usernameReuse(state: SessionState): ReuseGroup[] {
  const groups = new Map<string, Set<PlatformId>>();
  for (const c of mineCandidates(state)) {
    const h = comparableHandle(c);
    if (!h) continue;
    if (!groups.has(h)) groups.set(h, new Set());
    groups.get(h)!.add(c.platform);
  }
  return [...groups.entries()]
    .filter(([, p]) => p.size > 1)
    .map(([handle, p]) => ({ handle, platforms: [...p] }));
}

export type GuideKey = 'editProfile' | 'privacy' | 'oldPosts' | 'deletion' | 'contact';

export interface Fix {
  id: string;
  title: string;
  why: string;
  platform?: PlatformId;
  candidateId?: string;
  guide?: GuideLink & { key: GuideKey };
  /** Evidence this fix is based on, e.g. "API-confirmed" or "You marked this public". */
  basis: string;
  priority: number;
  /** In-app destination instead of an external guide. */
  goTo?: 'review';
}

export function guideFor(platform: PlatformId, key: GuideKey): (GuideLink & { key: GuideKey }) | undefined {
  const g = GUIDES[platform];
  const link = key === 'contact' ? g.contact ?? g.editProfile : g[key];
  if (!link) return undefined;
  const url = guideUrl(link.url);
  return url ? { ...link, url, key } : undefined;
}

const GOAL_WEIGHT: Record<PrivacyGoal, Partial<Record<string, number>>> = {
  'personal-details': { contact: 30, affiliation: 30, name: 20, linked: 15 },
  'old-posts': { oldPosts: 50 },
  professional: { name: -40, affiliation: -30, linked: -20, contact: 10 },
  curious: {},
};

function basisOf(row: FieldRow): string {
  return row.provenance === 'api' ? 'API-confirmed' : 'You marked this public';
}

/** Up to three suggestions derived only from real API data and the user's own answers. */
export function nextFixes(state: SessionState, limit = 3): Fix[] {
  const fixes: Fix[] = [];
  const goal = state.input.goal;
  const weight = (key: string) => (goal ? GOAL_WEIGHT[goal][key] ?? 0 : 0);

  for (const c of mineCandidates(state)) {
    if (state.plans[c.id] === 'keep') continue; // user chose to keep this one public as-is
    const name = platformName(c.platform);
    const at = c.handle ? ` (@${c.handle})` : '';
    for (const row of fieldRows(c, state)) {
      if (!isShown(row)) continue;
      const base = { platform: c.platform, candidateId: c.id, basis: basisOf(row) };
      switch (row.question) {
        case 'contact':
          fixes.push({
            ...base,
            id: `fix:contact:${c.id}`,
            title: `Remove your personal email or phone number from ${name}${at}`,
            why: 'Contact details in a public profile can be copied by anyone who visits.',
            guide: guideFor(c.platform, 'contact'),
            priority: 100 + weight('contact'),
          });
          break;
        case 'affiliation':
          fixes.push({
            ...base,
            id: `fix:affiliation:${c.id}`,
            title: `Review school, workplace or location details on ${name}${at}`,
            why: 'Decide whether these details need to be public, or could be shown to fewer people.',
            guide: guideFor(c.platform, 'editProfile'),
            priority: 80 + weight('affiliation'),
          });
          break;
        case 'oldPosts':
          fixes.push({
            ...base,
            id: `fix:oldPosts:${c.id}`,
            title: `Review old posts or photos on ${name}${at}`,
            why: 'You said there are older posts you want to look over. Archiving or deleting them is up to you.',
            guide: guideFor(c.platform, 'oldPosts'),
            priority: 70 + weight('oldPosts'),
          });
          break;
        case 'linked':
          fixes.push({
            ...base,
            id: `fix:linked:${c.id}`,
            title: `Check which accounts or sites your ${name} profile links to`,
            why: 'Links between profiles make it easier to connect them to each other.',
            guide: guideFor(c.platform, 'editProfile'),
            priority: 50 + weight('linked'),
          });
          break;
        case 'name':
          fixes.push({
            ...base,
            id: `fix:name:${c.id}`,
            title: `Decide whether your full name should appear on ${name}`,
            why: 'Keep it if this profile is meant to be found, like a portfolio or work account.',
            guide: guideFor(c.platform, 'editProfile'),
            priority: 40 + weight('name'),
          });
          break;
      }
    }
  }

  for (const group of usernameReuse(state)) {
    fixes.push({
      id: `fix:reuse:${group.handle}`,
      title: `Consider whether you want the same handle “${group.handle}” on ${group.platforms.map(platformName).join(' and ')}`,
      why: 'A reused handle may make these profiles easier to associate with each other.',
      basis: 'Profiles you confirmed',
      priority: 45 + weight('linked'),
    });
  }

  const c = counts(state);
  if (c.unsure > 0) {
    fixes.push({
      id: 'fix:unsure',
      title: `Take another look at ${c.unsure === 1 ? 'the profile' : `the ${c.unsure} profiles`} you marked Unsure`,
      why: "If one is yours, it can be included in this summary. If it isn't, you can leave it.",
      basis: 'Your answers',
      priority: 30,
      goTo: 'review',
    });
  }

  return fixes.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/** Mine profiles that have no checklist answers yet and no API data. */
export function unansweredMine(state: SessionState): Candidate[] {
  return mineCandidates(state).filter(
    (c) => Object.keys(state.checklist[c.id] ?? {}).length === 0 && state.lookups[c.id]?.status !== 'api-returned',
  );
}

