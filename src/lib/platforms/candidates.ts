import { PLATFORMS } from './directory';
import { cleanRawHandle, isNumericFacebookId, normalizeHandle } from './handles';
import { looksLikeLink, parseProfileLink } from './parseLink';
import { platformUrl, webSearchUrl } from './safeUrl';
import { PLATFORM_ORDER, type CandidateBasis, type CandidateKind, type PlatformId } from '../types';

export const MAX_USERNAMES = 5;
export const MAX_LINKS = 8;
export const MAX_DISPLAY_NAME = 80;

export interface Candidate {
  id: string;
  platform: PlatformId;
  kind: CandidateKind;
  basis: CandidateBasis;
  /** Safe, allowlisted https URL. For "api" candidates this is the manual fallback link. */
  url: string;
  handle?: string;
  query?: string;
}

export interface SkippedEntry {
  platform: PlatformId;
  value: string;
  reason: string;
}

export interface WebSearchShortcut {
  id: string;
  query: string;
  url: string;
}

export interface CandidateInput {
  usernames: string[];
  links: string[];
  displayName: string;
  platforms: PlatformId[];
}

export interface CandidateSet {
  candidates: Candidate[];
  skipped: SkippedEntry[];
  linkErrors: { raw: string; reason: string }[];
  webSearches: WebSearchShortcut[];
  /** Platforms included because a pasted link pointed there, even if not ticked. */
  platforms: PlatformId[];
}

/** Split free text into entries on commas, semicolons, whitespace or newlines. */
export function splitEntries(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Separate a usernames box into plain usernames and anything that looks like a link.
 * Usernames are de-duplicated case-insensitively and capped (this is a self-check,
 * not a bulk lookup tool).
 */
export function splitUsernamesAndLinks(usernamesText: string, linksText: string) {
  const usernames: string[] = [];
  const links: string[] = [];
  const seen = new Set<string>();
  for (const entry of splitEntries(usernamesText)) {
    if (looksLikeLink(entry)) links.push(entry);
    else {
      const cleaned = cleanRawHandle(entry);
      const key = cleaned.toLowerCase();
      if (cleaned && !seen.has(key)) {
        seen.add(key);
        usernames.push(cleaned);
      }
    }
  }
  for (const entry of linksText.split(/[\s]+/).map((s) => s.trim()).filter(Boolean)) {
    if (!links.includes(entry)) links.push(entry);
  }
  return { usernames, links };
}

function candidateId(platform: PlatformId, kind: CandidateKind, key: string): string {
  return `${platform}:${kind}:${key.toLowerCase()}`;
}

/**
 * Build the list of things to review. Nothing here touches the network:
 * API candidates are looked up later by the check adapters; everything else
 * is a link the user opens and judges themselves.
 */
export function generateCandidates(input: CandidateInput): CandidateSet {
  const candidates = new Map<string, Candidate>();
  const skipped: SkippedEntry[] = [];
  const linkErrors: { raw: string; reason: string }[] = [];
  const platforms = new Set<PlatformId>(input.platforms);
  const usernames = input.usernames.slice(0, MAX_USERNAMES);
  const displayName = input.displayName.replace(/\s+/g, ' ').trim().slice(0, MAX_DISPLAY_NAME);

  const add = (c: Candidate) => {
    const existing = candidates.get(c.id);
    // A pasted link is stronger evidence than a guess from a username.
    if (!existing || (c.basis === 'pasted-link' && existing.basis !== 'pasted-link')) candidates.set(c.id, c);
  };

  const addProfile = (platform: PlatformId, handle: string, basis: CandidateBasis) => {
    const def = PLATFORMS[platform];
    const template = platform === 'facebook' && isNumericFacebookId(handle) && def.numericProfileUrl ? def.numericProfileUrl : def.profileUrl;
    const url = platformUrl(platform, template, { handle });
    if (!url) return;
    const kind: CandidateKind = def.check === 'api' ? 'api' : 'profile';
    add({ id: candidateId(platform, kind, handle), platform, kind, basis, url, handle });
  };

  const addSearch = (platform: PlatformId, query: string, basis: CandidateBasis) => {
    const template = PLATFORMS[platform].searchUrl;
    if (!template) return;
    const url = platformUrl(platform, template, { query });
    if (!url) return;
    add({ id: candidateId(platform, 'search', query), platform, kind: 'search', basis, url, query });
  };

  // 1. Pasted links: strongest signal. They also add their platform to the run.
  for (const raw of input.links.slice(0, MAX_LINKS)) {
    const parsed = parseProfileLink(raw);
    if (!parsed.ok) {
      linkErrors.push({ raw: parsed.raw, reason: parsed.reason });
      continue;
    }
    platforms.add(parsed.platform);
    addProfile(parsed.platform, parsed.handle, 'pasted-link');
  }

  // 2. Usernames applied to every selected platform where the handle is valid.
  const ordered = PLATFORM_ORDER.filter((p) => platforms.has(p));
  for (const platform of ordered) {
    const def = PLATFORMS[platform];
    for (const raw of usernames) {
      const res = normalizeHandle(platform, raw);
      if (!res.ok) {
        skipped.push({ platform, value: raw, reason: res.reason });
        continue;
      }
      addProfile(platform, res.handle, 'username');
    }
    // 3. Search shortcuts. Facebook/LinkedIn slugs are ambiguous, so they always
    //    get a search shortcut; others only when a display name was given.
    if (displayName) addSearch(platform, displayName, 'display-name');
    else if (def.ambiguous) for (const u of usernames) addSearch(platform, cleanRawHandle(u), 'username');
  }

  const webSearches: WebSearchShortcut[] = [];
  for (const u of usernames) {
    const query = `"${cleanRawHandle(u)}"`;
    const url = webSearchUrl(query);
    if (url) webSearches.push({ id: `web:${query.toLowerCase()}`, query, url });
  }

  const rank = (c: Candidate) => PLATFORM_ORDER.indexOf(c.platform) * 10 + (c.kind === 'search' ? 1 : 0);
  const sorted = [...candidates.values()].sort((a, b) => rank(a) - rank(b));
  return { candidates: sorted, skipped, linkErrors, webSearches, platforms: ordered };
}
