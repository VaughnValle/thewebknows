import { PLATFORMS } from './directory';
import { normalizeHandle } from './handles';
import { PLATFORM_ORDER, type PlatformId } from '../types';

export type ParsedLink =
  | { ok: true; platform: PlatformId; handle: string; raw: string }
  | { ok: false; raw: string; reason: string };

const HOST_TO_PLATFORM = new Map<string, PlatformId>();
for (const id of PLATFORM_ORDER) {
  for (const host of PLATFORMS[id].hosts) HOST_TO_PLATFORM.set(host, id);
}

export function looksLikeLink(value: string): boolean {
  const v = value.trim().toLowerCase();
  return /^[a-z][a-z0-9+.-]*:/.test(v) || /^(www\.|m\.)?[a-z0-9-]+\.[a-z]{2,}\//.test(v) || HOST_TO_PLATFORM.has(v.split('/')[0]);
}

function fail(raw: string, reason: string): ParsedLink {
  return { ok: false, raw, reason };
}

/**
 * Turn a pasted profile link into { platform, handle }. The pasted URL itself is
 * never opened or fetched: we only extract a handle, and callers rebuild a
 * canonical link from the platform directory.
 */
export function parseProfileLink(input: string): ParsedLink {
  const raw = input.trim();
  if (!raw) return fail(raw, 'Empty link');

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fail(raw, "This doesn't look like a web link.");
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail(raw, 'Only ordinary web links (https://…) are accepted.');
  }
  if (url.username || url.password || url.port) {
    return fail(raw, "This link has extra parts we don't accept (a login or port).");
  }

  const host = url.hostname.toLowerCase();
  const platform = HOST_TO_PLATFORM.get(host);
  if (!platform) {
    return fail(raw, `Links from ${host || 'this site'} aren't supported. Supported: ${PLATFORM_ORDER.map((p) => PLATFORMS[p].name).join(', ')}.`);
  }

  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const reserved = new Set(PLATFORMS[platform].reservedPaths.map((s) => s.toLowerCase()));
  const notProfile = fail(raw, `This ${PLATFORMS[platform].name} link doesn't point to a profile page.`);

  let rawHandle: string | undefined;
  switch (platform) {
    case 'github':
    case 'instagram':
    case 'x':
      rawHandle = segments[0];
      if (!rawHandle || reserved.has(rawHandle.toLowerCase())) return notProfile;
      break;
    case 'tiktok':
      if (!segments[0]?.startsWith('@')) return notProfile;
      rawHandle = segments[0].slice(1);
      break;
    case 'bluesky':
      if (segments[0] !== 'profile' || !segments[1]) return notProfile;
      rawHandle = segments[1];
      break;
    case 'linkedin':
      if (segments[0] !== 'in' || !segments[1]) return notProfile;
      rawHandle = segments[1];
      break;
    case 'reddit':
      if ((segments[0] !== 'user' && segments[0] !== 'u') || !segments[1]) return notProfile;
      rawHandle = segments[1];
      break;
    case 'facebook': {
      const first = segments[0]?.toLowerCase();
      if (first === 'profile.php') {
        rawHandle = url.searchParams.get('id') ?? undefined;
        if (!rawHandle || !/^\d{5,20}$/.test(rawHandle)) return notProfile;
      } else if (first === 'people' && segments[2] && /^\d{5,20}$/.test(segments[2])) {
        rawHandle = segments[2];
      } else {
        rawHandle = segments[0];
        if (!rawHandle || reserved.has(rawHandle.toLowerCase())) return notProfile;
      }
      break;
    }
  }

  const result = normalizeHandle(platform, rawHandle ?? '');
  if (!result.ok) return result.reason === 'empty' ? notProfile : fail(raw, result.reason);
  return { ok: true, platform, handle: result.handle, raw };
}
