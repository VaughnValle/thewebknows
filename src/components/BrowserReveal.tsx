import { useEffect, useRef, useState } from 'react';
import { DeviceReport } from './DeviceReport';
import { Icon } from './Icon';
import { ScrambleText } from './ScrambleText';
import { useDevice } from '../session/DeviceContext';
import { formatFingerprint } from '../lib/device/parse';
import { heroFacts, heroFingerprint, heroSentence, segText, type Seg } from '../lib/device/hero';

const KICKER: Seg[] = [{ t: 'Before you typed anything' }];
const TITLE: Seg[] = [{ t: 'The web already knows this about you.' }];

/** Intro phases: 0 kicker, 1 title, 2 sentence, 3 sharper facts, 4 fingerprint, 5 everything. */
type Phase = 0 | 1 | 2 | 3 | 4 | 5;
const DONE: Phase = 5;
const MS_PER_CHAR: Record<Exclude<Phase, 5>, number> = { 0: 45, 1: 55, 2: 34, 3: 34, 4: 55 };
/** A short breath before each value, then a longer hold once it's fully typed, so it sinks in. */
const PAUSE_BEFORE_EM = 250;
const PAUSE_AFTER_EM = 950;

/** The intro plays once per page load, not every time you come back to this step. */
let introPlayed = false;

function reduceMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Milliseconds to wait before typing character `i`. */
function delayAt(segs: Seg[], i: number, ms: number): number {
  let d = ms;
  let pos = 0;
  for (const s of segs) {
    if (i === pos && s.em && i > 0) d += PAUSE_BEFORE_EM;
    pos += s.t.length;
    if (i === pos && s.em) d += PAUSE_AFTER_EM;
  }
  return d;
}

function typingTime(segs: Seg[], ms: number): number {
  const n = segText(segs).length;
  let t = 0;
  for (let i = 0; i < n; i++) t += delayAt(segs, i, ms);
  return t;
}

function useTypewriter(segs: Seg[], active: boolean, ms: number) {
  const [n, setN] = useState(0);
  const total = segText(segs).length;
  useEffect(() => {
    if (!active) return;
    setN(0);
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i >= total) return;
      i++;
      setN(i);
      t = setTimeout(tick, delayAt(segs, i, ms));
    };
    t = setTimeout(tick, delayAt(segs, 0, ms));
    return () => clearTimeout(t);
    // Re-run only when the text itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segText(segs), active, ms]);
  return active ? Math.min(n, total) : total;
}

/** Hero text in runs; emphasised runs render as values. Screen readers get the whole string at once. */
function Runs({ segs, shown, scramble }: { segs: Seg[]; shown: number; scramble: boolean }) {
  let pos = 0;
  return (
    <>
      {segs.map((s, i) => {
        const start = pos;
        pos += s.t.length;
        const visible = Math.max(0, Math.min(s.t.length, shown - start));
        if (visible === 0) return null;
        const text = s.t.slice(0, visible);
        if (!s.em) return <span key={i} aria-hidden="true">{text}</span>;
        if (scramble) return <ScrambleText key={i} text={text} delay={150 + i * 120} className="reveal-value" />;
        return (
          <span key={i} className="reveal-value" aria-hidden="true">
            {text}
          </span>
        );
      })}
    </>
  );
}

function Typed({ segs, phase, at, scramble = false }: { segs: Seg[]; phase: Phase; at: Exclude<Phase, 5>; scramble?: boolean }) {
  const typing = phase === at;
  const shown = useTypewriter(segs, typing, MS_PER_CHAR[at]);
  if (phase < at) return null;
  return (
    <>
      <span className="visually-hidden">{segText(segs)}</span>
      <Runs segs={segs} shown={typing ? shown : segText(segs).length} scramble={scramble && !typing} />
      {typing && <span className="caret" aria-hidden="true" />}
    </>
  );
}

/** First screen: what any site can see, before the visitor types anything. */
export function BrowserReveal({ onCheckProfiles }: { onCheckProfiles: () => void }) {
  const { signals, who, whoStatus, items } = useDevice();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(() => (introPlayed || reduceMotion() ? DONE : 0));
  const playedIntro = useRef(phase !== DONE);
  const whoRef = useRef(whoStatus);
  whoRef.current = whoStatus;

  const showPlace = whoStatus !== 'unavailable';
  const sentence = heroSentence(signals, who, showPlace);
  const facts = heroFacts(signals, who);
  const fp = heroFingerprint(signals);
  const fingerprint = signals?.fingerprint ? formatFingerprint(signals.fingerprint.hash) : null;
  const shared = items.filter((i) => i.accuracy !== 'hidden').length;

  // Advance through the intro. Each phase types its line, then holds.
  useEffect(() => {
    if (phase === DONE) {
      introPlayed = true;
      return;
    }
    const segs = [KICKER, TITLE, sentence, facts, fp][phase];
    if (segs.length === 0) {
      setPhase((p) => (p + 1) as Phase);
      return;
    }
    const typed = typingTime(segs, MS_PER_CHAR[phase as Exclude<Phase, 5>]);
    const total = phase === 0 ? 3000 : phase === 1 ? 5000 : typed + (phase === 4 ? 1800 : 1400);
    let waited = 0;
    let t: ReturnType<typeof setTimeout>;
    const advance = () => {
      // Give the connection lookup a moment so the sentence isn't typed with blanks.
      if (phase === 1 && whoRef.current === 'loading' && waited < 3000) {
        waited += 300;
        t = setTimeout(advance, 300);
        return;
      }
      setPhase((p) => (p + 1) as Phase);
    };
    t = setTimeout(advance, Math.max(total, typed + 400));
    return () => clearTimeout(t);
    // Only re-arm when the phase changes; text updates mid-phase shouldn't restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const scramble = !playedIntro.current;
  const done = phase === DONE;

  return (
    <section className={`browser-reveal${done ? '' : ' is-intro'}${playedIntro.current ? ' played-intro' : ''}`} aria-labelledby="reveal-h">
      <p className="kicker">
        <Typed segs={KICKER} phase={phase} at={0} />
      </p>
      <h1 id="reveal-h" tabIndex={-1} data-step-heading className="reveal-title">
        <Typed segs={TITLE} phase={phase} at={1} />
      </h1>

      {phase >= 2 && (
        <p className="reveal-sentence">
          <Typed segs={sentence} phase={phase} at={2} scramble={scramble} />
        </p>
      )}

      {phase >= 3 && facts.length > 0 && (
        <p className="reveal-facts">
          <Typed segs={facts} phase={phase} at={3} scramble={scramble} />
        </p>
      )}

      {fingerprint && phase === 4 && (
        <p className="reveal-fp-typed">
          <Typed segs={fp} phase={phase} at={4} />
        </p>
      )}
      {fingerprint && done && (
        <div className="reveal-fp" aria-label="Your browser fingerprint">
          {scramble ? <ScrambleText text={fingerprint} delay={1450} className="reveal-fp-code" /> : <span className="reveal-fp-code">{fingerprint}</span>}
          <span className="reveal-fp-label">This is your browser’s fingerprint. It enables sites and their owners to track you and your data even without cookies!</span>
        </div>
      )}

      {done && (
        <>
          <p className="reveal-note">
            <Icon name="lock" size={14} /> This site only reads it from your browser session. Only you can see it and it’s not stored once you close the tab, and I can guarantee that!
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
        <button type="button" className="btn btn-ghost btn-sm reveal-skip" onClick={() => setPhase(DONE)}>
          Skip <Icon name="arrow-right" size={14} />
        </button>
      )}
    </section>
  );
}
