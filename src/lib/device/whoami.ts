import { cleanText } from '../checks/sanitize';
import type { WhoAmI } from '../../../functions/api/whoami';

export type { WhoAmI };

const empty = (ip: string): WhoAmI => ({
  ip,
  ipVersion: ip.includes(':') ? 6 : 4,
  isp: null,
  asn: null,
  city: null,
  region: null,
  country: null,
  postalCode: null,
  latitude: null,
  longitude: null,
  timezone: null,
  httpProtocol: null,
  tlsVersion: null,
});

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await run(ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Our own Cloudflare function: gives IP, ISP, city and more. */
async function fromFunction(fetchImpl: typeof fetch, signal: AbortSignal): Promise<WhoAmI | null> {
  const res = await fetchImpl('/api/whoami', { credentials: 'omit', cache: 'no-store', signal });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
  const raw = (await res.json()) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const ip = cleanText(raw.ip, 64);
  if (!ip) return null;
  return {
    ip,
    ipVersion: raw.ipVersion === 6 ? 6 : raw.ipVersion === 4 ? 4 : null,
    isp: cleanText(raw.isp, 120),
    asn: n(raw.asn),
    city: cleanText(raw.city, 120),
    region: cleanText(raw.region, 120),
    country: cleanText(raw.country, 2),
    postalCode: cleanText(raw.postalCode, 16),
    latitude: n(raw.latitude),
    longitude: n(raw.longitude),
    timezone: cleanText(raw.timezone, 64),
    httpProtocol: cleanText(raw.httpProtocol, 16),
    tlsVersion: cleanText(raw.tlsVersion, 16),
  };
}

/** Parse Cloudflare's /cdn-cgi/trace plain-text body (key=value per line). */
export function parseTrace(text: string): WhoAmI | null {
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) map.set(line.slice(0, i), line.slice(i + 1));
  }
  const ip = cleanText(map.get('ip'), 64);
  if (!ip) return null;
  const who = empty(ip);
  const loc = cleanText(map.get('loc'), 2);
  if (loc && /^[A-Za-z]{2}$/.test(loc)) who.country = loc.toUpperCase();
  who.httpProtocol = cleanText(map.get('http'), 16);
  who.tlsVersion = cleanText(map.get('tls'), 16);
  return who;
}

/**
 * Cloudflare's built-in trace endpoint, served by the edge for any proxied
 * domain with no setup. Gives at least IP and country when the Function isn't.
 */
async function fromTrace(fetchImpl: typeof fetch, signal: AbortSignal): Promise<WhoAmI | null> {
  const res = await fetchImpl('/cdn-cgi/trace', { credentials: 'omit', cache: 'no-store', signal });
  if (!res.ok) return null;
  return parseTrace(await res.text());
}

/**
 * What our connection looks like from outside. Tries our own function first
 * (IP + ISP + city), then falls back to Cloudflare's trace (IP + country), so
 * the location never silently disappears. Same origin only; null if both fail.
 */
export async function fetchWhoAmI(fetchImpl: typeof fetch = (...a) => fetch(...a), timeoutMs = 5000): Promise<WhoAmI | null> {
  return withTimeout(async (signal) => {
    const primary = await fromFunction(fetchImpl, signal).catch(() => null);
    if (primary) return primary;
    return fromTrace(fetchImpl, signal).catch(() => null);
  }, timeoutMs);
}
