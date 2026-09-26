import platformsJson from '../../data/platforms.json';
import guidesJson from '../../data/guides.json';
import type { CheckMode, PlatformId } from '../types';

export interface PlatformDef {
  id: PlatformId;
  name: string;
  check: CheckMode;
  /** Facebook/LinkedIn: slugs are not reliably the same as a username. */
  ambiguous?: boolean;
  hosts: string[];
  handle: { pattern: string; hint: string };
  profileUrl: string;
  numericProfileUrl?: string;
  searchUrl?: string;
  reservedPaths: string[];
}

export interface GuideLink {
  label: string;
  url: string;
}

export interface PlatformGuide {
  lastReviewed: string;
  editProfile: GuideLink;
  privacy: GuideLink;
  oldPosts: GuideLink;
  deletion: GuideLink;
  contact?: GuideLink;
  note?: string;
}

export const DIRECTORY_VERSION: string = platformsJson.version;
export const GUIDES_VERSION: string = guidesJson.version;
export const GUIDES_REVIEW_NOTE: string = guidesJson.reviewNote;

const platforms = platformsJson.platforms as PlatformDef[];

export const PLATFORMS: Record<PlatformId, PlatformDef> = Object.fromEntries(
  platforms.map((p) => [p.id, p]),
) as Record<PlatformId, PlatformDef>;

export const GUIDES = guidesJson.guides as Record<PlatformId, PlatformGuide>;

export const WEB_SEARCH = platformsJson.webSearch as {
  name: string;
  hosts: string[];
  searchUrl: string;
};

/** Hosts the official help/guide destinations live on. */
export const GUIDE_HOSTS: string[] = [
  'github.com',
  'docs.github.com',
  'blueskyweb.zendesk.com',
  'help.instagram.com',
  'support.tiktok.com',
  'help.x.com',
  'www.facebook.com',
  'www.linkedin.com',
  'support.reddithelp.com',
];

export function platformName(id: PlatformId): string {
  return PLATFORMS[id].name;
}

export function isApiPlatform(id: PlatformId): boolean {
  return PLATFORMS[id].check === 'api';
}
