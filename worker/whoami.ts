/**
 * Reads what Cloudflare already knows about the visitor's own request
 * (IP, network operator, approximate location) so the page can show it back.
 * Used by the Worker entry (worker/index.ts) to serve GET /api/whoami.
 * Nothing is logged or stored, and the response is never cached.
 */

/** The subset of Cloudflare's `request.cf` object we read. */
interface CfProperties {
  asn?: number;
  asOrganization?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  httpProtocol?: string;
  tlsVersion?: string;
}

export interface WhoAmI {
  ip: string | null;
  ipVersion: 4 | 6 | null;
  isp: string | null;
  asn: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  httpProtocol: string | null;
  tlsVersion: string | null;
}

const str = (v: unknown, max = 120): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function describeRequest(request: Request & { cf?: CfProperties }): WhoAmI {
  const cf = request.cf ?? {};
  const ip = str(request.headers.get('CF-Connecting-IP'), 64);
  return {
    ip,
    ipVersion: ip ? (ip.includes(':') ? 6 : 4) : null,
    isp: str(cf.asOrganization),
    asn: num(cf.asn),
    city: str(cf.city),
    region: str(cf.region),
    country: str(cf.country, 2),
    postalCode: str(cf.postalCode, 16),
    latitude: num(cf.latitude),
    longitude: num(cf.longitude),
    timezone: str(cf.timezone, 64),
    httpProtocol: str(cf.httpProtocol, 16),
    tlsVersion: str(cf.tlsVersion, 16),
  };
}

/** Build the GET /api/whoami JSON response (no caching, no storage). */
export function whoamiResponse(request: Request): Response {
  return new Response(JSON.stringify(describeRequest(request as Request & { cf?: CfProperties })), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
