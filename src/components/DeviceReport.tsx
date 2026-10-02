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
  id: GroupId;
  title: string;
  body: ReactNode;
}

function isTypingTarget(el: EventTarget | null) {
  return el instanceof HTMLElement && Boolean(el.closest('input, textarea, select, summary, [contenteditable="true"]'));
}

const SWIPE = 90;

/** One data group at a time, flipped through like the review deck. */
function GroupDeck({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const index = Math.min(i, cards.length - 1);
  const card = cards[index];

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(cards.length - 1, to));
      setDir(next >= index ? 1 : -1);
      setI(next);
    },
    [cards.length, index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
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
    if (e.button !== 0 || (e.target as HTMLElement).closest('a, button, summary, input, label')) return;
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
    <div className="report-deck">
      <nav className="report-deck-dots" aria-label="Categories">
        <ol>
          {cards.map((c, n) => (
            <li key={c.id}>
              <button
                type="button"
                className={`report-dot${n === index ? ' is-current' : ''}`}
                aria-label={c.title}
                aria-current={n === index ? 'true' : undefined}
                onClick={() => go(n)}
              >
                <Icon name={GROUP_ICON[c.id]} size={15} />
              </button>
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
        <article
          key={index}
          className={`report-card enter-${dir > 0 ? 'right' : 'left'}${drag ? ' is-dragging' : ''}`}
          style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 40}deg)` } : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <h2 className="report-title">
            <Icon name={GROUP_ICON[card.id]} size={18} /> {card.title}
          </h2>
          {card.body}
        </article>
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

  const cards: Card[] = GROUPS.map((g) => {
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
    return { id: g.id, title: g.title, body };
  });

  return (
    <div id="device-report" className="device-report">
      <GroupDeck cards={cards} />

      <section className="report-group cant-see">
        <h2 className="report-title">
          <Icon name="shield" size={18} /> What sites can’t see
        </h2>
        <ul>
          {CANT_SEE.map((c) => (
            <li key={c.title}>
              <strong>{c.title}.</strong> {c.detail}
            </li>
          ))}
        </ul>
      </section>

      <PhotoCheck />

      <div className="report-demos">
        <p className="demos-intro">
          <Icon name="info" size={15} /> Live demonstrations of what a page can do without asking. Everything below runs on your
          device and is shown only to you.
        </p>
        <div className="report-grid">
          <NetworkLeak />
          <AutofillDemo />
          <SocialLoginNote />
        </div>
      </div>
    </div>
  );
}
