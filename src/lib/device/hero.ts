import type { Signals } from './collect';
import type { WhoAmI } from './whoami';
import { countryName, deviceName, formatFingerprint, heroChip, parseUserAgent } from './parse';

/** One run of hero text. Emphasised runs are the values the visitor's browser gave away. */
export interface Seg {
  t: string;
  em?: boolean;
}

const TAKES_THE = /^(United States|United Kingdom|Philippines|Netherlands|United Arab Emirates|Czech(ia| Republic)|Dominican Republic|Bahamas|Maldives|Gambia)$/;

export function placeName(who: WhoAmI | null): string | null {
  if (!who) return null;
  const country = countryName(who.country);
  if (who.city) return [who.city, country].filter(Boolean).join(', ');
  if (!country) return null;
  return TAKES_THE.test(country) ? `the ${country}` : country;
}

export const segText = (segs: Seg[]) => segs.map((s) => s.t).join('');

/** "You’re in Quezon City, online through Converge. You’re on a Mac, using Chrome, and it’s 9:59 PM where you are." */
export function heroSentence(s: Signals | null, who: WhoAmI | null, showPlace: boolean): Seg[] {
  const b = s ? parseUserAgent(s.ua, { brands: s.brands, maxTouchPoints: s.maxTouchPoints, platformVersion: s.platformVersion }) : null;
  const browser = b?.browser ? [b.browser, b.version].filter(Boolean).join(' ') : null;
  const device = b ? deviceName(b) : null;
  const chip = heroChip(s?.gpu);
  const time = s ? s.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const place = placeName(who);
  const isp = who?.isp ? who.isp.replace(/[.\s]+$/, '') : null;

  const segs: Seg[] = [];
  if (showPlace && place) {
    segs.push({ t: 'You’re in ' }, { t: place, em: true });
    if (isp) segs.push({ t: ', online through ' }, { t: isp, em: true });
    segs.push({ t: '. ' });
  }
  segs.push({ t: 'You’re on ' }, { t: device ?? 'a device', em: true });
  if (chip) segs.push({ t: ' (' }, { t: chip, em: true }, { t: ')' });
  segs.push({ t: ', using ' }, { t: browser ?? 'a browser', em: true }, { t: ', and it’s ' }, { t: time ?? 'now', em: true }, { t: ' where you are.' });
  return segs;
}

function referrerHost(ref: string | null): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (typeof location !== 'undefined' && u.hostname === location.hostname) return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * The sharper facts: things most people don't expect a page to know.
 * Up to four, most striking first. Every value comes straight from this browser or connection.
 */
export function heroFacts(s: Signals | null, who: WhoAmI | null): Seg[] {
  if (!s) return [];
  const clauses: Seg[][] = [];
  if (who?.ip) clauses.push([{ t: 'Your IP address is ' }, { t: who.ip, em: true }, { t: '.' }]);
  const from = referrerHost(s.referrer);
  if (from) clauses.push([{ t: 'You came here from ' }, { t: from, em: true }, { t: '.' }]);
  if (s.battery) {
    const pct = `${Math.round(s.battery.level * 100)}%`;
    clauses.push([{ t: 'Your battery is at ' }, { t: s.battery.charging ? `${pct}, charging` : pct, em: true }, { t: '.' }]);
  }
  if (s.screen) clauses.push([{ t: 'Your screen is ' }, { t: `${s.screen.width} × ${s.screen.height}`, em: true }, { t: '.' }]);
  if (s.memoryGb || s.cores) {
    const parts = [s.memoryGb ? `${s.memoryGb >= 8 ? 'at least 8' : s.memoryGb} GB of memory` : null, s.cores ? `${s.cores} processor threads` : null].filter(Boolean);
    clauses.push([{ t: 'You have ' }, { t: parts.join(' and '), em: true }, { t: '.' }]);
  }
  if (s.languages.length > 1) clauses.push([{ t: 'You read ' }, { t: s.languages.slice(0, 3).join(', '), em: true }, { t: '.' }]);
  if (s.darkMode !== null) clauses.push([{ t: 'You prefer ' }, { t: s.darkMode ? 'dark mode' : 'light mode', em: true }, { t: '.' }]);

  const picked = clauses.slice(0, 4);
  return picked.flatMap((c, i) => (i === 0 ? c : [{ t: ' ' }, ...c]));
}

export function heroFingerprint(s: Signals | null): Seg[] {
  if (!s?.fingerprint) return [];
  return [{ t: 'Your browser fingerprint is ' }, { t: formatFingerprint(s.fingerprint.hash), em: true }];
}
