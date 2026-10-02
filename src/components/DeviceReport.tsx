import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
import { AutofillDemo } from './AutofillDemo';
import { NetworkLeak } from './NetworkLeak';
import { PhotoCheck } from './PhotoCheck';
import { SocialLoginNote } from './SocialLoginNote';
import { useDevice } from '../session/DeviceContext';
import { ACCURACY_LABEL, CANT_SEE, GROUPS, LEARN, type GroupId, type ReportItem } from '../lib/device/report';
import { resourceUrl } from '../lib/platforms/safeUrl';

const GROUP_ICON: Record<GroupId, IconName> = {
  network: 'globe',
  browser: 'monitor',
  hardware: 'chip',
  connection: 'wifi',
  privacy: 'sliders',
  fingerprint: 'fingerprint',
};

function Row({ item }: { item: ReportItem }) {
  const learn = LEARN[item.id];
  return (
    <details className={`report-row acc-${item.accuracy}`}>
      <summary>
        <span className="report-label">{item.label}</span>
        <span className="report-value">{item.value}</span>
        <span className="report-acc">{ACCURACY_LABEL[item.accuracy]}</span>
        <Icon name="chevron" size={14} className="chev" />
      </summary>
      {learn && (
        <dl className="report-learn">
          <dt>What it is</dt>
          <dd>{learn.what}</dd>
          <dt>Why it matters</dt>
          <dd>{learn.why}</dd>
          <dt>How to limit it</dt>
          <dd>{learn.limit}</dd>
        </dl>
      )}
    </details>
  );
}

interface Card {
  id: string;
  icon: IconName;
  title: string;
  tag?: 'demo';
  body: ReactNode;
}

function isTypingTarget(el: EventTarget | null) {
  return el instanceof HTMLElement && Boolean(el.closest('input, textarea, select, summary, [contenteditable="true"]'));
}

const SWIPE = 90;

/**
 * One card at a time, flipped like the review deck. All cards stay mounted
 * (hidden when not current) so the interactive demos keep their state.
 */
function ReportDeck({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const dir = useRef(1);
  const cardRef = useRef<HTMLElement | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(cards.length - 1, to));
      dir.current = next >= index ? 1 : -1;
      setIndex(next);
    },
    [cards.length, index],
  );

  // Re-trigger the slide-in animation on the (persistent) current card.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('enter-right', 'enter-left');
    void el.offsetWidth;
    el.classList.add(dir.current > 0 ? 'enter-right' : 'enter-left');
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      // Only the deck being hovered or focused responds, so stacked decks don't both move.
      const el = rootRef.current;
      if (!el) return;
      let active = el.contains(document.activeElement);
      try {
        active = active || el.matches(':hover');
      } catch {
        /* jsdom */
      }
      if (!active) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  const onDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a, button, summary, input, label, img')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!drag && Math.abs(dx) < 8) return;
    if (!drag && Math.abs(dy) > Math.abs(dx)) {
      start.current = null;
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag(dx);
  };
  const onUp = () => {
    const dx = drag;
    start.current = null;
    setDrag(0);
    if (dx > SWIPE) go(index - 1);
    else if (dx < -SWIPE) go(index + 1);
  };

  return (
    <div className="report-deck" ref={rootRef}>
      <nav className="report-deck-dots" aria-label="Sections">
        <ol>
          {cards.map((c, n) => (
            <li key={c.id}>
              <button
                type="button"
                className={`report-dot${n === index ? ' is-current' : ''}${c.tag === 'demo' ? ' is-demo' : ''}`}
                aria-label={c.title}
                aria-current={n === index ? 'true' : undefined}
                onClick={() => go(n)}
              />
            </li>
          ))}
        </ol>
        <span className="report-deck-count" role="status">
          {index + 1} / {cards.length}
        </span>
      </nav>

      <div className="report-deck-stack">
        <div className="report-ghost g2" aria-hidden="true" />
        <div className="report-ghost g1" aria-hidden="true" />
        {cards.map((c, n) => {
          const isCurrent = n === index;
          return (
            <article
              key={c.id}
              ref={isCurrent ? cardRef : undefined}
              className={`report-card${c.tag === 'demo' ? ' is-demo' : ''}${drag && isCurrent ? ' is-dragging' : ''}`}
              aria-label={c.title}
              hidden={!isCurrent}
              style={isCurrent && drag ? { transform: `translateX(${drag}px) rotate(${drag / 40}deg)` } : undefined}
              onPointerDown={isCurrent ? onDown : undefined}
              onPointerMove={isCurrent ? onMove : undefined}
              onPointerUp={isCurrent ? onUp : undefined}
              onPointerCancel={isCurrent ? onUp : undefined}
            >
              <h2 className="report-title">
                <Icon name={c.icon} size={18} /> {c.title}
                {c.tag === 'demo' && <span className="report-demo-tag">Live demo</span>}
              </h2>
              {c.body}
            </article>
          );
        })}
      </div>

      <div className="report-deck-nav">
        <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => go(index - 1)}>
          <Icon name="arrow-left" size={15} /> Back
        </button>
        <span className="report-deck-hint">
          <span className="hint-keys">← → to flip</span>
          <span className="hint-touch">Swipe to flip</span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={index === cards.length - 1} onClick={() => go(index + 1)}>
          Next <Icon name="arrow-right" size={15} />
        </button>
      </div>
    </div>
  );
}

export function DeviceReport() {
  const { items, whoStatus, extrasReady } = useDevice();
  const eff = resourceUrl('https://coveryourtracks.eff.org/');

  const dataCards: Card[] = GROUPS.map((g) => {
    const rows = items.filter((i) => i.group === g.id);
    let body: ReactNode;
    if (rows.length > 0) {
      body = (
        <>
          <p className="report-blurb">{g.blurb}</p>
          <div className="report-rows">
            {rows.map((r) => (
              <Row key={r.id} item={r} />
            ))}
          </div>
          {g.id === 'fingerprint' && eff && (
            <ExternalLink href={eff} className="text-link">
              How unique is it? Test at EFF’s Cover Your Tracks
            </ExternalLink>
          )}
        </>
      );
    } else if (g.id === 'network') {
      body = (
        <p className="report-blurb">
          {whoStatus === 'loading' ? 'Looking up your connection…' : 'We couldn’t look up your connection right now. Sites you visit still can.'}
        </p>
      );
    } else {
      body = <p className="report-blurb">{g.id === 'fingerprint' && !extrasReady ? 'Calculating…' : g.blurb}</p>;
    }
    return { id: g.id, icon: GROUP_ICON[g.id], title: g.title, body };
  });

  const demoCards: Card[] = [
    { id: 'photo', icon: 'image', title: 'Check a photo before you post it', tag: 'demo', body: <PhotoCheck /> },
    { id: 'net-leak', icon: 'wifi', title: 'Your local network', tag: 'demo', body: <NetworkLeak /> },
    { id: 'autofill', icon: 'monitor', title: 'The autofill trap', tag: 'demo', body: <AutofillDemo /> },
    { id: 'social', icon: 'globe', title: 'Which sites you’re logged into', body: <SocialLoginNote /> },
  ];

  return (
    <div id="device-report" className="device-report">
      <p className="report-deck-intro">
        <Icon name="info" size={15} /> What any website learns the moment you open it. Flip through — it’s all read on your
        device and shown only to you.
      </p>
      <ReportDeck cards={dataCards} />

      <section className="report-aside cant-see" aria-labelledby="cantsee-h">
        <h2 id="cantsee-h" className="report-title">
          <Icon name="shield" size={18} /> What sites can’t see
        </h2>
        <p className="report-blurb">The reassuring part: these stay private unless you choose to share them.</p>
        <ul className="cant-see-list">
          {CANT_SEE.map((c) => (
            <li key={c.title}>
              <strong>{c.title}.</strong> {c.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="demos-section" aria-labelledby="demos-h">
        <h2 id="demos-h" className="demos-heading">
          Want to dig deeper?
        </h2>
        <p className="report-deck-intro">
          <Icon name="info" size={15} /> Live demos of what a page can do without asking, plus one risk we explain rather than run
          against you. Everything stays on your device.
        </p>
        <ReportDeck cards={demoCards} />
      </section>
    </div>
  );
}
