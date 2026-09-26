import { GUIDE_HOSTS, PLATFORMS, WEB_SEARCH } from './directory';
import type { PlatformId } from '../types';

/**
 * Parse a URL and return its canonical string only if it is https, has no
 * credentials or custom port, and its host is exactly one of `allowedHosts`.
 * Anything else (javascript:, lookalike hosts, userinfo tricks) returns null.
 */
export function allowlistedUrl(raw: string, allowedHosts: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.includes(host)) return null;
  return url.toString();
}

/** Substitute `{name}` placeholders, percent-encoding every value. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Missing template value: ${key}`);
    return encodeURIComponent(v);
  });
}

export function platformUrl(platform: PlatformId, template: string, values: Record<string, string>): string | null {
  return allowlistedUrl(fillTemplate(template, values), PLATFORMS[platform].hosts);
}

export function webSearchUrl(query: string): string | null {
  return allowlistedUrl(fillTemplate(WEB_SEARCH.searchUrl, { query }), WEB_SEARCH.hosts);
}

export function guideUrl(url: string): string | null {
  return allowlistedUrl(url, GUIDE_HOSTS);
}
