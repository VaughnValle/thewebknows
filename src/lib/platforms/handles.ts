import { PLATFORMS } from './directory';
import type { PlatformId } from '../types';

export type HandleResult = { ok: true; handle: string } | { ok: false; reason: string };

const DID_PATTERN = /^did:(plc:[a-z2-7]{24}|web:[a-z0-9.-]+)$/;
const patternCache = new Map<PlatformId, RegExp>();

function patternFor(platform: PlatformId): RegExp {
  let re = patternCache.get(platform);
  if (!re) {
    re = new RegExp(PLATFORMS[platform].handle.pattern);
    patternCache.set(platform, re);
  }
  return re;
}

/** Clean up what someone typed: whitespace, a leading "@", zero-width characters. */
export function cleanRawHandle(raw: string): string {
  return raw
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .replace(/^@+/, '');
}

/**
 * Normalize and validate a handle for one platform. Returns the handle in the
 * form the platform's URL/API expects, or a plain-language reason it can't be used.
 */
export function normalizeHandle(platform: PlatformId, raw: string): HandleResult {
  let handle = cleanRawHandle(raw);
  if (!handle) return { ok: false, reason: 'empty' };

  if (platform === 'bluesky') {
    handle = handle.toLowerCase();
    if (DID_PATTERN.test(handle)) return { ok: true, handle };
    // A bare name is most likely a default bsky.social handle.
    if (!handle.includes('.')) handle = `${handle}.bsky.social`;
  }

  if (platform === 'facebook' && /^\d{5,20}$/.test(handle)) {
    // Numeric profile IDs only come from pasted links; allowed as-is.
    return { ok: true, handle };
  }

  if (!patternFor(platform).test(handle)) {
    return { ok: false, reason: `${PLATFORMS[platform].name} usernames are ${PLATFORMS[platform].handle.hint}` };
  }
  return { ok: true, handle };
}

export function isNumericFacebookId(handle: string): boolean {
  return /^\d{5,20}$/.test(handle);
}
