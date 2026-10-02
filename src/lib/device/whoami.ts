import { cleanText } from '../checks/sanitize';
import type { WhoAmI } from '../../../functions/api/whoami';

export type { WhoAmI };

/**
 * Ask our own Cloudflare function what our connection looks like from outside.
 * Same origin only; returns null on any problem (offline, local dev, blocked).
 */
export async function fetchWhoAmI(fetchImpl: typeof fetch = (...a) => fetch(...a), timeoutMs = 5000): Promise<WhoAmI | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('/api/whoami', { credentials: 'omit', cache: 'no-store', signal: ctrl.signal });
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
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
