/** Pure helpers for turning raw browser values into readable facts. All unit-tested. */

export interface BrowserInfo {
  browser: string | null;
  version: string | null;
  os: string | null;
  deviceType: 'Phone' | 'Tablet' | 'Desktop';
}

interface Brand {
  brand: string;
  version: string;
}

const BRAND_NAMES: [RegExp, string][] = [
  [/edge/i, 'Microsoft Edge'],
  [/opera/i, 'Opera'],
  [/brave/i, 'Brave'],
  [/vivaldi/i, 'Vivaldi'],
  [/samsung/i, 'Samsung Internet'],
  [/google chrome/i, 'Chrome'],
  [/chromium/i, 'Chromium'],
];

/** Parse a user-agent string (with optional client-hint brands) into browser, version, OS and device type. */
export function parseUserAgent(ua: string, opts: { brands?: Brand[]; maxTouchPoints?: number; platformVersion?: string } = {}): BrowserInfo {
  let browser: string | null = null;
  let version: string | null = null;

  const brand = opts.brands?.find((b) => BRAND_NAMES.some(([re]) => re.test(b.brand)));
  if (brand) {
    browser = BRAND_NAMES.find(([re]) => re.test(brand.brand))![1];
    version = brand.version;
  } else {
    const tests: [RegExp, string][] = [
      [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Microsoft Edge'],
      [/OPR\/([\d.]+)/, 'Opera'],
      [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
      [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
      [/CriOS\/([\d.]+)/, 'Chrome'],
      [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Version\/([\d.]+).*Safari/, 'Safari'],
    ];
    for (const [re, name] of tests) {
      const m = ua.match(re);
      if (m) {
        browser = name;
        version = m[1];
        break;
      }
    }
  }
  if (version) version = version.split('.').slice(0, version.startsWith('0') ? 2 : 1).join('.');

  let os: string | null = null;
  const touch = opts.maxTouchPoints ?? 0;
  if (/iPhone/.test(ua)) os = `iOS ${ua.match(/OS (\d+)[_.](\d+)/)?.slice(1, 3).join('.') ?? ''}`.trim();
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) os = 'iPadOS';
  else if (/Android/.test(ua)) os = `Android ${ua.match(/Android ([\d.]+)/)?.[1]?.split('.')[0] ?? ''}`.trim();
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Windows NT 10/.test(ua)) {
    const major = Number(opts.platformVersion?.split('.')[0]);
    os = major >= 13 ? 'Windows 11' : opts.platformVersion ? 'Windows 10' : 'Windows 10 or 11';
  } else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) {
    const v = opts.platformVersion?.split('.').slice(0, 1).join('.');
    os = v && Number(v) >= 11 ? `macOS ${v}` : 'macOS';
  } else if (/Linux/.test(ua)) os = 'Linux';

  let deviceType: BrowserInfo['deviceType'] = 'Desktop';
  if (/iPad|Tablet/.test(ua) || (/Macintosh/.test(ua) && touch > 1) || (/Android/.test(ua) && !/Mobile/.test(ua))) deviceType = 'Tablet';
  else if (/Mobi|iPhone|Android/.test(ua)) deviceType = 'Phone';

  return { browser, version, os, deviceType };
}

/**
 * A short, recognisable chip name fit for the hero, or null when the renderer is a
 * generic/software one (SwiftShader, llvmpipe…) or too long to read at a glance.
 */
export function heroChip(gpu: string | null | undefined): string | null {
  const name = cleanGpuName(gpu);
  if (!name) return null;
  if (/swiftshader|llvmpipe|software|microsoft basic|mesa|virgl|vmware|vulkan|generic|angle/i.test(name)) return null;
  if (name.length > 26) return null;
  return name;
}

/**
 * A friendly, tangible device name for the hero, e.g. "a Mac", "an iPhone".
 * Prefers the OS, falls back to the device type.
 */
export function deviceName(info: BrowserInfo): string {
  const os = info.os ?? '';
  if (/^iOS/.test(os)) return 'an iPhone';
  if (/iPadOS/.test(os)) return 'an iPad';
  if (/Android/.test(os)) return info.deviceType === 'Tablet' ? 'an Android tablet' : 'an Android phone';
  if (/^macOS|Mac OS/.test(os)) return 'a Mac';
  if (/Windows/.test(os)) return 'a Windows PC';
  if (/ChromeOS/.test(os)) return 'a Chromebook';
  if (/Linux/.test(os)) return 'a Linux computer';
  if (info.deviceType === 'Phone') return 'a phone';
  if (info.deviceType === 'Tablet') return 'a tablet';
  return 'a computer';
}

/** "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)" → "Apple M1 Pro" */
export function cleanGpuName(renderer: string | null | undefined): string | null {
  if (!renderer) return null;
  let r = renderer.trim();
  const angle = r.match(/^ANGLE \(([^,]+),\s*(.+?)(?:,\s*[^,]*)?\)$/);
  if (angle) r = angle[2];
  r = r
    .replace(/^ANGLE \w+ Renderer:\s*/i, '')
    .replace(/\s*Direct3D.*$/i, '')
    .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
    .replace(/\s*vs_\d_\d ps_\d_\d/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return r || null;
}

const HOSTING = /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|linode|akamai|hetzner|ovh|vultr|oracle|cloudflare|fastly|scaleway|contabo|leaseweb|choopa|m247|datacamp|hosting|server|vpn|proxy|mullvad|nord|express ?vpn|proton|private internet access|surfshark/i;
const MOBILE = /mobile|wireless|cellular|t-mobile|verizon wireless|at&t mobility|vodafone|orange|telcel|globe telecom|smart communications|jio|airtel|three|o2 |ee limited|telstra|optus|rogers|bell mobility|movistar|claro|tim |mtn|safaricom|softbank|ntt docomo|kddi|sk telecom/i;
const EDUCATION = /university|college|school|academ|institute|edu\b|research/i;

/** Best-effort guess of the network kind from the operator name and the Network Information API. */
export function guessNetworkType(isp: string | null, connectionType?: string | null): string | null {
  if (connectionType === 'cellular') return 'Mobile data';
  if (!isp) return connectionType === 'wifi' ? 'Wi-Fi' : null;
  if (HOSTING.test(isp)) return 'Data center or VPN';
  if (EDUCATION.test(isp)) return 'School or university network';
  if (MOBILE.test(isp)) return 'Mobile or home broadband';
  return 'Home or office broadband';
}

export function countryName(code: string | null, locale = 'en'): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "UTC+08:00" style offset for a time zone at a given moment. */
export function utcOffset(date: Date): string {
  const mins = -date.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Short, readable fingerprint: first 12 hex chars in groups of four. */
export function formatFingerprint(hex: string): string {
  return hex.slice(0, 12).match(/.{4}/g)!.join(' ');
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb >= 100 ? Math.round(gb) : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
