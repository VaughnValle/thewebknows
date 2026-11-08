import { useEffect, useRef, useState } from 'react';
import { DeviceReport } from './DeviceReport';
import { Icon } from './Icon';
import { ScrambleText } from './ScrambleText';
import { useDevice } from '../session/DeviceContext';
import { countryName, deviceName, formatFingerprint, heroChip, parseUserAgent } from '../lib/device/parse';

const KICKER = 'Before you typed anything';
const TITLE = 'The web already knows this about you.';
const TAKES_THE = /^(United States|United Kingdom|Philippines|Netherlands|United Arab Emirates|Czech(ia| Republic)|Dominican Republic|Bahamas|Maldives|Gambia)$/;

/** Intro phases: 0 kicker, 1 title, 2 sentence, 3 fingerprint, 4 everything. */
type Phase = 0 | 1 | 2 | 3 | 4;
const MS_PER_CHAR: Record<Exclude<Phase, 4>, number> = { 0: 45, 1: 55, 2: 28, 3: 45 };

/** The intro plays once per page load, not every time you come back to this step. */
let introPlayed = false;

function reduceMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useTypewriter(text: string, active: boolean, ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const id = setInterval(() => {
      setN((k) => {
        if (k >= text.length) {
          clearInterval(id);
          return k;
        }
        return k + 1;
      });
    }, ms);
    return () => clearInterval(id);
  }, [text, active, ms]);
  return active ? text.slice(0, n) : text;
}

/** Typed text for the intro. Screen readers get the whole string at once. */
function Typed({ text, phase, at, className }: { text: string; phase: Phase; at: Exclude<Phase, 4>; className?: string }) {
  const typing = phase === at;
  const shown = useTypewriter(text, typing, MS_PER_CHAR[at]);
  if (phase < at) return null;
  return (
    <span className={className}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">{typing ? shown : text}</span>
      {typing && <span className="caret" aria-hidden="true" />}
    </span>
  );
}

function Value({ text, delay, animate }: { text: string | null; delay: number; animate: boolean }) {
  if (!text) return <span className="reveal-value is-pending" aria-hidden="true" />;
  if (!animate) return <span className="reveal-value">{text}</span>;
  return <ScrambleText text={text} delay={delay} className="reveal-value" />;
}

/** First screen: what any site can see, before the visitor types anything. */
export function BrowserReveal({ onCheckProfiles }: { onCheckProfiles: () => void }) {
  const { signals, who, whoStatus, items } = useDevice();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(() => (introPlayed || reduceMotion() ? 4 : 0));
  const playedIntro = useRef(phase !== 4);
  const whoRef = useRef(whoStatus);
  whoRef.current = whoStatus;

  const b = signals ? parseUserAgent(signals.ua, { brands: signals.brands, maxTouchPoints: signals.maxTouchPoints, platformVersion: signals.platformVersion }) : null;
  const browser = b?.browser ? [b.browser, b.version].filter(Boolean).join(' ') : null;
  const device = b ? deviceName(b) : null;
  const chip = heroChip(signals?.gpu);
  const time = signals ? signals.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const country = who ? countryName(who.country) : null;
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
  const fingerprint = signals?.fingerprint ? formatFingerprint(signals.fingerprint.hash) : null;
  const shared = items.filter((i) => i.accuracy !== 'hidden').length;
  const showPlace = whoStatus !== 'unavailable' && (place !== null || whoStatus === 'loading');

  // Plain-text version of the sentence, for the typewriter.
  const sentenceText = [
    showPlace && place ? `You’re in ${place}${isp ? `, online through ${isp}` : ''}.` : null,
    `You’re on ${device ?? 'a device'}${chip ? ` (${chip})` : ''}, using ${browser ?? 'a browser'}, and it’s ${time ?? 'now'} where you are.`,
  ]
    .filter(Boolean)
    .join(' ');
  const fingerprintText = fingerprint ? `Your browser fingerprint is ${fingerprint}` : '';

  // Advance through the intro. Each phase types its line, then holds.
  useEffect(() => {
    if (phase === 4) {
      introPlayed = true;
      return;
    }
    const typed = (phase === 0 ? KICKER : phase === 1 ? TITLE : phase === 2 ? sentenceText : fingerprintText).length * MS_PER_CHAR[phase];
    const total = phase === 0 ? 3000 : phase === 1 ? 5000 : phase === 2 ? typed + 1400 : typed + 1600;
    let waited = 0;
    let t: ReturnType<typeof setTimeout>;
    const advance = () => {
      // Give the connection lookup a moment so the sentence isn't typed with blanks.
      if (phase === 1 && whoRef.current === 'loading' && waited < 3000) {
        waited += 300;
        t = setTimeout(advance, 300);
        return;
      }
      setPhase((p) => (p === 2 && !fingerprintText ? 4 : ((p + 1) as Phase)));
    };
    t = setTimeout(advance, Math.max(total, typed + 400));
    return () => clearTimeout(t);
    // Only re-arm when the phase changes; text updates mid-phase shouldn't restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const animate = !playedIntro.current;
  const done = phase === 4;

  return (
    <section className={`browser-reveal${done ? '' : ' is-intro'}${playedIntro.current ? ' played-intro' : ''}`} aria-labelledby="reveal-h">
      <p className="kicker">
        <Typed text={KICKER} phase={phase} at={0} />
      </p>
      <h1 id="reveal-h" tabIndex={-1} data-step-heading className="reveal-title">
        <Typed text={TITLE} phase={phase} at={1} />
      </h1>

      {phase >= 2 && (
        <p className="reveal-sentence">
          {phase === 2 ? (
            <Typed text={sentenceText} phase={phase} at={2} />
          ) : (
            <>
              {showPlace && (
                <>
                  You’re in <Value text={place} delay={150} animate={animate} />
                  {(who?.isp || whoStatus === 'loading') && (
                    <>
                      , online through <Value text={isp} delay={450} animate={animate} />
                    </>
                  )}
                  .{' '}
                </>
              )}
              You’re on <Value text={device} delay={700} animate={animate} />
              {chip && (
                <>
                  {' '}
                  (<Value text={chip} delay={900} animate={animate} />)
                </>
              )}
              , using <Value text={browser} delay={1050} animate={animate} />, and it’s <Value text={time} delay={1250} animate={animate} /> where you are.
            </>
          )}
        </p>
      )}

      {fingerprint && phase === 3 && (
        <p className="reveal-fp-typed">
          <Typed text={fingerprintText} phase={phase} at={3} />
        </p>
      )}
      {fingerprint && done && (
        <div className="reveal-fp" aria-label="Your browser fingerprint">
          {animate ? <ScrambleText text={fingerprint} delay={1450} className="reveal-fp-code" /> : <span className="reveal-fp-code">{fingerprint}</span>}
          <span className="reveal-fp-label">Your browser’s fingerprint. It follows you even without cookies.</span>
        </div>
      )}

      {done && (
        <>
          <p className="reveal-note">
            <Icon name="lock" size={14} /> Read from your own browser. Seen only by you.
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
        </>
      )}

      {!done && (
        <button type="button" className="btn btn-ghost btn-sm reveal-skip" onClick={() => setPhase(4)}>
          Skip <Icon name="arrow-right" size={14} />
        </button>
      )}
    </section>
  );
}
