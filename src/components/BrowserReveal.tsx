import { useState } from 'react';
import { DeviceReport } from './DeviceReport';
import { Icon } from './Icon';
import { ScrambleText } from './ScrambleText';
import { useDevice } from '../session/DeviceContext';
import { countryName, deviceName, heroChip, parseUserAgent } from '../lib/device/parse';

function Value({ text, delay }: { text: string | null; delay: number }) {
  if (!text) return <span className="reveal-value is-pending" aria-hidden="true" />;
  return <ScrambleText text={text} delay={delay} className="reveal-value" />;
}

/** First screen: what any site can see, before the visitor types anything. */
export function BrowserReveal({ onCheckProfiles }: { onCheckProfiles: () => void }) {
  const { signals, who, whoStatus, items } = useDevice();
  const [open, setOpen] = useState(false);

  const b = signals ? parseUserAgent(signals.ua, { brands: signals.brands, maxTouchPoints: signals.maxTouchPoints, platformVersion: signals.platformVersion }) : null;
  const browser = b?.browser ? [b.browser, b.version].filter(Boolean).join(' ') : null;
  const device = b ? deviceName(b) : null;
  const chip = heroChip(signals?.gpu);
  const time = signals ? signals.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const country = who ? countryName(who.country) : null;
  const TAKES_THE = /^(United States|United Kingdom|Philippines|Netherlands|United Arab Emirates|Czech(ia| Republic)|Dominican Republic|Bahamas|Maldives|Gambia)$/;
  const place = who
    ? who.city
      ? [who.city, country].filter(Boolean).join(', ')
      : country
        ? TAKES_THE.test(country)
          ? `the ${country}`
          : country
        : null
    : null;
  const isp = who?.isp ? who.isp.replace(/[.\s]+$/, '') : null;
  const shared = items.filter((i) => i.accuracy !== 'hidden').length;

  return (
    <section className="browser-reveal" aria-labelledby="reveal-h">
      <p className="kicker">Before you typed anything</p>
      <h1 id="reveal-h" tabIndex={-1} data-step-heading className="reveal-title">
        The web already knows this about you.
      </h1>

      <p className="reveal-sentence">
        {whoStatus !== 'unavailable' && (
          <>
            You’re in <Value text={place} delay={150} />
            {(who?.isp || whoStatus === 'loading') && (
              <>
                , online through <Value text={isp} delay={450} />
              </>
            )}
            .{' '}
          </>
        )}
        You’re on <Value text={device} delay={700} />
        {chip && (
          <>
            {' '}
            (<Value text={chip} delay={900} />)
          </>
        )}
        , using <Value text={browser} delay={1050} />, and it’s <Value text={time} delay={1250} /> where you are.
      </p>

      <p className="reveal-note">
        <Icon name="lock" size={14} /> Read from your own browser and connection. Shown only to you, never stored.
      </p>

      <div className="reveal-actions">
        <button type="button" className="btn btn-primary" aria-expanded={open} aria-controls="device-report" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide the details' : `See all ${shared || ''} details`.replace('  ', ' ')}
          <Icon name="chevron" size={16} className={open ? 'chev-up' : undefined} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCheckProfiles}>
          Check your public profiles <Icon name="arrow-right" className="icon-go" />
        </button>
      </div>

      {open && <DeviceReport />}
    </section>
  );
}
