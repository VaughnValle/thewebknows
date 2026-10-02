import { describe, expect, it } from 'vitest';
import { cleanGpuName, formatFingerprint, guessNetworkType, parseUserAgent, utcOffset } from '../src/lib/device/parse';
import { browserFixes, buildItems, locationLine } from '../src/lib/device/report';
import { fetchWhoAmI, type WhoAmI } from '../src/lib/device/whoami';
import { describeRequest, onRequestGet } from '../functions/api/whoami';
import type { Signals } from '../src/lib/device/collect';

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
const WIN_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';

const who: WhoAmI = {
  ip: '203.0.113.42',
  ipVersion: 4,
  isp: 'PLDT Inc.',
  asn: 9299,
  city: 'Quezon City',
  region: 'Metro Manila',
  country: 'PH',
  postalCode: '1100',
  latitude: 14.676,
  longitude: 121.0437,
  timezone: 'Asia/Manila',
  httpProtocol: 'HTTP/2',
  tlsVersion: 'TLSv1.3',
};

function signals(over: Partial<Signals> = {}): Signals {
  return {
    ua: MAC_CHROME,
    maxTouchPoints: 0,
    languages: ['en-US', 'fil'],
    timezone: 'Asia/Manila',
    now: new Date('2026-10-02T04:42:00Z'),
    screen: { width: 2560, height: 1440, colorDepth: 24 },
    viewport: { width: 1265, height: 1280 },
    pixelRatio: 2,
    cores: 8,
    memoryGb: 8,
    gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
    pointer: 'fine',
    battery: { level: 0.82, charging: true },
    connection: { type: null, effectiveType: '4g', downlinkMbps: 10, rttMs: 50, saveData: false },
    media: { cameras: 1, microphones: 1, speakers: 1 },
    storageQuota: 120 * 1024 ** 3,
    dnt: null,
    gpc: false,
    cookies: true,
    darkMode: true,
    reducedMotion: false,
    plugins: 5,
    referrer: 'https://www.google.com/',
    fingerprint: { hash: 'a7f391c2e04b5d6e', traits: 14 },
    ...over,
  };
}

describe('user agent parsing', () => {
  it('reads browser, version, OS and device', () => {
    expect(parseUserAgent(MAC_CHROME)).toEqual({ browser: 'Chrome', version: '153', os: 'macOS', deviceType: 'Desktop' });
    expect(parseUserAgent(IPHONE_SAFARI)).toEqual({ browser: 'Safari', version: '18', os: 'iOS 18.2', deviceType: 'Phone' });
    expect(parseUserAgent(WIN_FIREFOX)).toMatchObject({ browser: 'Firefox', version: '140', os: 'Windows 10 or 11' });
    expect(parseUserAgent(ANDROID)).toMatchObject({ browser: 'Chrome', os: 'Android 15', deviceType: 'Phone' });
  });

  it('uses client hints when available', () => {
    const r = parseUserAgent(MAC_CHROME, { brands: [{ brand: 'Microsoft Edge', version: '153' }], platformVersion: '15.4.0' });
    expect(r).toMatchObject({ browser: 'Microsoft Edge', os: 'macOS 15' });
    expect(parseUserAgent(WIN_FIREFOX, { platformVersion: '15.0.0' }).os).toBe('Windows 11');
  });

  it('spots iPads that pretend to be Macs', () => {
    expect(parseUserAgent(MAC_CHROME, { maxTouchPoints: 5 })).toMatchObject({ os: 'iPadOS', deviceType: 'Tablet' });
  });
});

describe('small formatters', () => {
  it('cleans GPU renderer strings', () => {
    expect(cleanGpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)')).toBe('Apple M1 Pro');
    expect(cleanGpuName('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('NVIDIA GeForce RTX 4070');
    expect(cleanGpuName('Apple GPU')).toBe('Apple GPU');
    expect(cleanGpuName(null)).toBeNull();
  });

  it('guesses network types without overclaiming', () => {
    expect(guessNetworkType('PLDT Inc.')).toBe('Home or office broadband');
    expect(guessNetworkType('DigitalOcean, LLC')).toBe('Data center or VPN');
    expect(guessNetworkType('New York University')).toBe('School or university network');
    expect(guessNetworkType('T-Mobile USA, Inc.')).toBe('Mobile or home broadband');
    expect(guessNetworkType('Anything', 'cellular')).toBe('Mobile data');
    expect(guessNetworkType(null)).toBeNull();
  });

  it('formats offsets and fingerprints', () => {
    expect(formatFingerprint('a7f391c2e04b5d6e')).toBe('a7f3 91c2 e04b');
    expect(utcOffset(new Date())).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
  });
});

describe('report items', () => {
  it('includes network details only when the lookup worked', () => {
    const withIp = buildItems(signals(), who);
    expect(withIp.find((i) => i.id === 'ip')?.value).toBe('203.0.113.42');
    expect(withIp.find((i) => i.id === 'isp')?.value).toBe('PLDT Inc. (AS9299)');
    expect(withIp.find((i) => i.id === 'location')).toMatchObject({ value: 'Quezon City, Metro Manila, Philippines', accuracy: 'guess' });

    const without = buildItems(signals(), null);
    expect(without.some((i) => i.group === 'network')).toBe(false);
  });

  it('labels what the browser did not share instead of hiding it', () => {
    const items = buildItems(signals({ battery: null, memoryGb: null, connection: null, gpu: null }), null);
    for (const id of ['battery', 'memory', 'speed', 'gpu']) {
      expect(items.find((i) => i.id === id)).toMatchObject({ accuracy: 'hidden', value: 'Not shared by your browser' });
    }
  });

  it('formats device values readably', () => {
    const items = Object.fromEntries(buildItems(signals(), who).map((i) => [i.id, i.value]));
    expect(items).toMatchObject({
      browser: 'Chrome 153',
      gpu: 'Apple M1 Pro',
      memory: 'At least 8 GB',
      battery: '82%, charging',
      referrer: 'www.google.com',
      fingerprint: 'a7f3 91c2 e04b',
      gpc: 'Off',
    });
    expect(items.screen).toBe('2560 × 1440, 24-bit colour');
  });

  it('builds a readable location line', () => {
    expect(locationLine({ ...who, region: 'Quezon City' })).toBe('Quezon City, Philippines');
    expect(locationLine(null)).toBeNull();
  });
});

describe('browser fixes', () => {
  it('suggests up to three based on real signals', () => {
    expect(browserFixes(signals(), who).map((f) => f.id)).toEqual(['browser:ip', 'browser:gpc', 'browser:fingerprint']);
  });
  it('skips what is already handled', () => {
    const fixes = browserFixes(signals({ gpc: true }), { ...who, isp: 'Mullvad VPN AB' }).map((f) => f.id);
    expect(fixes).toEqual(['browser:fingerprint']);
  });
  it('returns nothing before signals are read', () => {
    expect(browserFixes(null, who)).toEqual([]);
  });
});

describe('whoami function', () => {
  const req = (headers: Record<string, string>, cf: Record<string, unknown>) =>
    Object.assign(new Request('https://thewebknows.me/api/whoami', { headers }), { cf });

  it('echoes Cloudflare request details', () => {
    const r = describeRequest(req({ 'CF-Connecting-IP': '2001:db8::1' }, { asOrganization: 'PLDT Inc.', asn: 9299, city: 'Quezon City', country: 'PH', latitude: '14.676', longitude: '121.04' }));
    expect(r).toMatchObject({ ip: '2001:db8::1', ipVersion: 6, isp: 'PLDT Inc.', asn: 9299, city: 'Quezon City', latitude: 14.676 });
  });

  it('never lets the response be cached', async () => {
    const res = onRequestGet({ request: req({ 'CF-Connecting-IP': '203.0.113.42' }, {}) });
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toMatchObject({ ip: '203.0.113.42', ipVersion: 4, city: null });
  });
});

describe('whoami client', () => {
  const json = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

  it('returns sanitized data', async () => {
    const r = await fetchWhoAmI(json({ ...who, isp: 'PLDT‮ Inc.' }));
    expect(r?.isp).toBe('PLDT Inc.');
  });
  it('returns null when unavailable (local dev, offline, errors)', async () => {
    expect(await fetchWhoAmI(json({}, 404))).toBeNull();
    expect(await fetchWhoAmI((async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchWhoAmI((async () => { throw new TypeError('offline'); }) as unknown as typeof fetch)).toBeNull();
    expect(await fetchWhoAmI(json({ ip: null }))).toBeNull();
  });
});
