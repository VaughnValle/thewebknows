import { cleanGpuName, countryName, formatBytes, formatFingerprint, guessNetworkType, parseUserAgent, utcOffset } from './parse';
import type { Signals } from './collect';
import type { WhoAmI } from './whoami';

export type GroupId = 'network' | 'browser' | 'hardware' | 'connection' | 'privacy' | 'fingerprint';
export type Accuracy = 'exact' | 'estimate' | 'guess' | 'hidden';

export interface ReportItem {
  id: string;
  group: GroupId;
  label: string;
  value: string;
  accuracy: Accuracy;
}

export const GROUPS: { id: GroupId; title: string; blurb: string }[] = [
  { id: 'network', title: 'Your network', blurb: 'What every site sees when you connect.' },
  { id: 'browser', title: 'Browser & system', blurb: 'Shared automatically with every page.' },
  { id: 'hardware', title: 'Your device', blurb: 'Readable by any script, no permission asked.' },
  { id: 'connection', title: 'Connection', blurb: 'Speed and quality estimates.' },
  { id: 'privacy', title: 'Privacy settings', blurb: 'Signals your browser sends, or doesn’t.' },
  { id: 'fingerprint', title: 'Fingerprint', blurb: 'All of the above, combined.' },
];

export const ACCURACY_LABEL: Record<Accuracy, string> = {
  exact: 'Exact',
  estimate: 'Estimate',
  guess: 'Guess',
  hidden: 'Not shared',
};

export interface Learn {
  what: string;
  why: string;
  limit: string;
}

/** Plain-language notes for each item, written for this site. */
export const LEARN: Record<string, Learn> = {
  ip: {
    what: 'The address your internet connection uses to send and receive data. Every site you visit gets it automatically.',
    why: 'It points to your provider and rough area, and it links your visits together across a session or longer.',
    limit: 'A trustworthy VPN or Tor Browser shows sites a different address. Your VPN provider still sees the real one.',
  },
  isp: {
    what: 'The company that gives you internet access, looked up from your IP address.',
    why: 'It hints at where you are and whether you’re at home, at work, at school or on mobile data.',
    limit: 'A VPN or Tor Browser hides it behind the VPN’s or Tor network’s provider.',
  },
  location: {
    what: 'A city-level guess based on where your IP address is registered. No GPS involved.',
    why: 'Sites use it for local prices and content, and trackers use it to build a profile of you.',
    limit: 'A VPN or Tor Browser moves this guess elsewhere. Your real location stays private unless you allow GPS access.',
  },
  coords: {
    what: 'The centre of the area your IP address maps to. Often a few kilometres off, sometimes much more.',
    why: 'Combined with other details, even a rough area narrows down who you might be.',
    limit: 'Same as location: a VPN or Tor Browser changes it.',
  },
  nettype: {
    what: 'Our guess at the kind of network you’re on, based on your provider’s name.',
    why: 'Sites treat home, mobile, office and VPN connections differently, for example for fraud checks.',
    limit: 'Nothing to change here. It follows from your IP address.',
  },
  browser: {
    what: 'Your browser’s name and version, sent with every request.',
    why: 'Useful for compatibility, but also one of the main ingredients of a fingerprint.',
    limit: 'Keep your browser up to date so you look like many other people on the same version.',
  },
  os: {
    what: 'Your operating system, reported by the browser.',
    why: 'Another common fingerprint ingredient, and a hint at what device you own.',
    limit: 'Privacy-focused browsers report more generic values.',
  },
  device: {
    what: 'Whether you look like a phone, tablet or computer.',
    why: 'Sites adapt their layout, and trackers add it to your profile.',
    limit: 'Nothing to change; it’s part of how the web works.',
  },
  languages: {
    what: 'The languages you’ve told your browser you prefer, in order.',
    why: 'An unusual combination makes you easier to tell apart from others.',
    limit: 'Keep just the languages you need in your browser settings.',
  },
  timezone: {
    what: 'Your device’s time zone and offset from UTC.',
    why: 'If it doesn’t match your IP location, sites can tell you’re using a VPN.',
    limit: 'Tor Browser reports UTC to everyone.',
  },
  localtime: {
    what: 'The time on your device right now.',
    why: 'Together with your time zone, it adds to your profile and reveals your routine over time.',
    limit: 'Nothing to change.',
  },
  referrer: {
    what: 'The page you came from, if your browser shared it.',
    why: 'Sites learn what you searched for or what linked you here.',
    limit: 'Many browsers now trim this to just the site name. Strict tracking protection trims it further.',
  },
  screen: {
    what: 'Your screen’s resolution and colour depth.',
    why: 'Uncommon sizes help tell devices apart.',
    limit: 'Nothing simple. Tor Browser reports rounded, common sizes.',
  },
  viewport: {
    what: 'The size of the browser window you’re reading this in.',
    why: 'Combined with screen size, it’s surprisingly distinctive.',
    limit: 'Full-screen or standard window sizes blend in better.',
  },
  pixelratio: {
    what: 'How many screen pixels make up one CSS pixel. 2× usually means a high-resolution display.',
    why: 'It hints at your device model.',
    limit: 'Nothing to change.',
  },
  cpu: {
    what: 'How many tasks your processor can run at once.',
    why: 'It hints at how powerful, and how new, your device is.',
    limit: 'Some privacy browsers report a fixed number instead.',
  },
  memory: {
    what: 'A rounded estimate of your device’s memory. Browsers cap it at 8 GB.',
    why: 'Another hint at your device model.',
    limit: 'Firefox and Safari don’t share it at all.',
  },
  gpu: {
    what: 'Your graphics chip, read through WebGL.',
    why: 'Often names your exact chip, which narrows down your device a lot.',
    limit: 'Firefox with resist-fingerprinting, Brave and Tor Browser hide or generalise it.',
  },
  storage: {
    what: 'How much storage your browser offers to sites. In some browsers it tracks your free disk space.',
    why: 'An unusual value can help recognise your device, and a very small one can reveal private browsing.',
    limit: 'Nothing simple to change.',
  },
  battery: {
    what: 'Your battery level and whether you’re charging.',
    why: 'Short-term, it can help link visits that happen within minutes of each other.',
    limit: 'Firefox and Safari stopped sharing it. Chrome and Edge still do.',
  },
  input: {
    what: 'Whether you have a touchscreen and what kind of pointer you use.',
    why: 'Another small clue about your device.',
    limit: 'Nothing to change.',
  },
  media: {
    what: 'Whether a camera, microphone and speakers are connected. Not what they see or hear: that needs your permission.',
    why: 'The number and type of devices adds to your fingerprint.',
    limit: 'Nothing to change. Never grant camera or microphone access to sites you don’t trust.',
  },
  conntype: {
    what: 'The kind of connection your browser reports, if it shares one.',
    why: 'It tells sites whether you’re on Wi-Fi or mobile data.',
    limit: 'Only Chromium-based browsers share it.',
  },
  speed: {
    what: 'Your browser’s rough estimate of download speed and delay.',
    why: 'Sites use it to decide how heavy a page to send you.',
    limit: 'Only Chromium-based browsers share it.',
  },
  gpc: {
    what: 'Global Privacy Control is a signal asking sites not to sell or share your data.',
    why: 'In some places, like California and Colorado, sites are legally required to respect it.',
    limit: 'Turn it on in your browser or with a privacy extension. Brave, DuckDuckGo and Firefox support it.',
  },
  dnt: {
    what: 'An older “Do Not Track” request.',
    why: 'Most sites ignore it, and turning it on can make you slightly more unique.',
    limit: 'Prefer Global Privacy Control instead.',
  },
  cookies: {
    what: 'Whether your browser accepts cookies.',
    why: 'Cookies are the classic way to recognise you between visits.',
    limit: 'Block third-party cookies and clear cookies regularly.',
  },
  theme: {
    what: 'Whether your device is set to dark or light mode.',
    why: 'Harmless alone, but it’s one more trait in your fingerprint.',
    limit: 'Nothing to change.',
  },
  motion: {
    what: 'Whether you’ve asked your device to reduce animations.',
    why: 'An accessibility setting that sites can read. One more fingerprint trait.',
    limit: 'Keep it if you need it. Accessibility comes first.',
  },
  plugins: {
    what: 'Built-in viewers your browser lists, like the PDF viewer.',
    why: 'Modern browsers report a standard list, so this matters less than it used to.',
    limit: 'Avoid installing old-style plugins.',
  },
  fingerprint: {
    what: 'A code we built from the traits above. Sites do the same to recognise your browser without cookies.',
    why: 'Clearing cookies or using private browsing doesn’t change it. Many of these traits stay the same for months.',
    limit: 'Brave, Firefox (strict mode) and Tor Browser change or blur these traits. Test yours at EFF’s Cover Your Tracks.',
  },
};

const hidden = (id: string, group: GroupId, label: string): ReportItem => ({ id, group, label, value: 'Not shared by your browser', accuracy: 'hidden' });

export function locationLine(who: WhoAmI | null): string | null {
  if (!who) return null;
  const country = countryName(who.country);
  const parts = [who.city, who.region && who.region !== who.city ? who.region : null, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function buildItems(s: Signals, who: WhoAmI | null, locale = 'en'): ReportItem[] {
  const items: ReportItem[] = [];
  const add = (i: ReportItem) => items.push(i);
  const b = parseUserAgent(s.ua, { brands: s.brands, maxTouchPoints: s.maxTouchPoints, platformVersion: s.platformVersion });

  // Network (from our own Cloudflare function)
  if (who) {
    if (who.ip) add({ id: 'ip', group: 'network', label: who.ipVersion === 6 ? 'IP address (IPv6)' : 'IP address', value: who.ip, accuracy: 'exact' });
    if (who.isp) add({ id: 'isp', group: 'network', label: 'Internet provider', value: who.asn ? `${who.isp} (AS${who.asn})` : who.isp, accuracy: 'exact' });
    const loc = locationLine(who);
    if (loc) add({ id: 'location', group: 'network', label: 'Approximate location', value: loc, accuracy: 'guess' });
    if (who.latitude !== null && who.longitude !== null)
      add({ id: 'coords', group: 'network', label: 'Approximate coordinates', value: `${who.latitude.toFixed(2)}, ${who.longitude.toFixed(2)}`, accuracy: 'guess' });
    const nt = guessNetworkType(who.isp, s.connection?.type);
    if (nt) add({ id: 'nettype', group: 'network', label: 'Network type', value: nt, accuracy: 'guess' });
  }

  // Browser & system
  add(b.browser ? { id: 'browser', group: 'browser', label: 'Browser', value: [b.browser, b.version].filter(Boolean).join(' '), accuracy: 'exact' } : hidden('browser', 'browser', 'Browser'));
  add(b.os ? { id: 'os', group: 'browser', label: 'Operating system', value: b.os, accuracy: s.platformVersion ? 'exact' : 'estimate' } : hidden('os', 'browser', 'Operating system'));
  add({ id: 'device', group: 'browser', label: 'Device type', value: b.deviceType, accuracy: 'guess' });
  if (s.languages.length) add({ id: 'languages', group: 'browser', label: 'Languages', value: s.languages.join(', '), accuracy: 'exact' });
  if (s.timezone) add({ id: 'timezone', group: 'browser', label: 'Time zone', value: `${s.timezone.replace(/_/g, ' ')} (${utcOffset(s.now)})`, accuracy: 'exact' });
  add({
    id: 'localtime',
    group: 'browser',
    label: 'Local time',
    value: s.now.toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
    accuracy: 'exact',
  });
  if (s.referrer) {
    let ref = s.referrer;
    try {
      const u = new URL(s.referrer);
      ref = u.pathname === '/' ? u.hostname : `${u.hostname}${u.pathname}`;
    } catch {
      /* keep raw */
    }
    add({ id: 'referrer', group: 'browser', label: 'Came from', value: ref, accuracy: 'exact' });
  }

  // Device
  if (s.screen) add({ id: 'screen', group: 'hardware', label: 'Screen', value: `${s.screen.width} × ${s.screen.height}, ${s.screen.colorDepth}-bit colour`, accuracy: 'exact' });
  add({ id: 'viewport', group: 'hardware', label: 'Window size', value: `${s.viewport.width} × ${s.viewport.height}`, accuracy: 'exact' });
  add({ id: 'pixelratio', group: 'hardware', label: 'Pixel density', value: `${Math.round(s.pixelRatio * 100) / 100}×`, accuracy: 'exact' });
  add(s.cores ? { id: 'cpu', group: 'hardware', label: 'Processor threads', value: String(s.cores), accuracy: 'exact' } : hidden('cpu', 'hardware', 'Processor threads'));
  add(s.memoryGb ? { id: 'memory', group: 'hardware', label: 'Memory', value: `${s.memoryGb >= 8 ? 'At least 8' : s.memoryGb} GB`, accuracy: 'estimate' } : hidden('memory', 'hardware', 'Memory'));
  const gpu = cleanGpuName(s.gpu);
  add(gpu ? { id: 'gpu', group: 'hardware', label: 'Graphics', value: gpu, accuracy: 'exact' } : hidden('gpu', 'hardware', 'Graphics'));
  if (s.storageQuota) add({ id: 'storage', group: 'hardware', label: 'Storage offered to sites', value: formatBytes(s.storageQuota), accuracy: 'estimate' });
  add(
    s.battery
      ? { id: 'battery', group: 'hardware', label: 'Battery', value: `${Math.round(s.battery.level * 100)}%${s.battery.charging ? ', charging' : ''}`, accuracy: 'exact' }
      : hidden('battery', 'hardware', 'Battery'),
  );
  const input = [s.maxTouchPoints > 0 ? 'Touchscreen' : 'No touchscreen', s.pointer === 'fine' ? 'mouse or trackpad' : s.pointer === 'coarse' ? 'finger' : null]
    .filter(Boolean)
    .join(', ');
  add({ id: 'input', group: 'hardware', label: 'Input', value: input, accuracy: 'estimate' });
  if (s.media) {
    const parts = [s.media.cameras && 'camera', s.media.microphones && 'microphone', s.media.speakers && 'speakers'].filter(Boolean) as string[];
    add({ id: 'media', group: 'hardware', label: 'Camera & audio', value: parts.length ? `${parts.join(', ').replace(/^./, (c) => c.toUpperCase())} present` : 'None detected', accuracy: 'estimate' });
  }

  // Connection
  if (s.connection) {
    if (s.connection.type) add({ id: 'conntype', group: 'connection', label: 'Connection type', value: s.connection.type, accuracy: 'exact' });
    if (s.connection.downlinkMbps !== null || s.connection.rttMs !== null) {
      const parts = [s.connection.downlinkMbps !== null ? `~${s.connection.downlinkMbps} Mbps` : null, s.connection.rttMs !== null ? `${s.connection.rttMs} ms delay` : null].filter(Boolean);
      add({ id: 'speed', group: 'connection', label: 'Estimated speed', value: `${parts.join(', ')}${s.connection.effectiveType ? ` (${s.connection.effectiveType})` : ''}`, accuracy: 'estimate' });
    }
  } else {
    items.push(hidden('speed', 'connection', 'Estimated speed'));
  }

  // Privacy signals
  add({ id: 'gpc', group: 'privacy', label: 'Global Privacy Control', value: s.gpc ? 'On' : 'Off', accuracy: 'exact' });
  add({ id: 'dnt', group: 'privacy', label: 'Do Not Track', value: s.dnt ? 'On' : 'Off', accuracy: 'exact' });
  add({ id: 'cookies', group: 'privacy', label: 'Cookies', value: s.cookies ? 'Allowed' : 'Blocked', accuracy: 'exact' });
  if (s.darkMode !== null) add({ id: 'theme', group: 'privacy', label: 'Appearance', value: s.darkMode ? 'Dark mode' : 'Light mode', accuracy: 'exact' });
  if (s.reducedMotion !== null) add({ id: 'motion', group: 'privacy', label: 'Reduced motion', value: s.reducedMotion ? 'On' : 'Off', accuracy: 'exact' });
  add({ id: 'plugins', group: 'privacy', label: 'Built-in plugins', value: String(s.plugins), accuracy: 'exact' });

  // Fingerprint
  if (s.fingerprint) add({ id: 'fingerprint', group: 'fingerprint', label: `Built from ${s.fingerprint.traits} traits`, value: formatFingerprint(s.fingerprint.hash), accuracy: 'exact' });

  return items;
}

export interface BrowserFix {
  id: string;
  title: string;
  why: string;
  link: { label: string; url: string };
}

/** Up to three browser-level suggestions based on what this browser actually shared. */
export function browserFixes(s: Signals | null, who: WhoAmI | null): BrowserFix[] {
  if (!s) return [];
  const fixes: BrowserFix[] = [];
  const nt = who ? guessNetworkType(who.isp, s.connection?.type) : null;
  if (who && nt !== 'Data center or VPN') {
    fixes.push({
      id: 'browser:ip',
      title: 'Your city and internet provider are visible to every site you visit',
      why: 'If that matters to you, a trustworthy VPN or Tor Browser shows sites a different address.',
      link: { label: 'Choosing a VPN', url: 'https://ssd.eff.org/module/choosing-vpn-thats-right-you' },
    });
  }
  if (!s.gpc) {
    fixes.push({
      id: 'browser:gpc',
      title: 'Turn on Global Privacy Control',
      why: 'It asks every site not to sell or share your data, and some laws require them to listen.',
      link: { label: 'How to turn it on', url: 'https://globalprivacycontrol.org/' },
    });
  }
  if (s.fingerprint) {
    fixes.push({
      id: 'browser:fingerprint',
      title: 'Make your browser harder to recognise',
      why: 'Brave, Firefox in strict mode and Tor Browser blur the traits that make up your fingerprint.',
      link: { label: 'Test your browser', url: 'https://coveryourtracks.eff.org/' },
    });
  }
  return fixes.slice(0, 3);
}

/** Things sites genuinely can't see without asking. Keeps the page informative, not frightening. */
export const CANT_SEE: { title: string; detail: string }[] = [
  { title: 'Your name or email', detail: 'Not unless you type them in or sign in.' },
  { title: 'Your files and photos', detail: 'Only the ones you choose to upload.' },
  { title: 'Your other tabs and history', detail: 'Sites can’t read what you do elsewhere.' },
  { title: 'Your camera, microphone or exact GPS', detail: 'Each needs your explicit permission.' },
  { title: 'Your device’s account name', detail: 'Your computer’s user name stays private.' },
];
