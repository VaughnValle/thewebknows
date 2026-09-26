import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CandidateCard, cardTitle, type Decision } from './CandidateCard';
import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { useSession } from '../session/SessionContext';
import { platformName } from '../lib/platforms/directory';
import { counts, identityOf, reviewable } from '../lib/report/summary';
import type { Candidate } from '../lib/platforms/candidates';

type Fly = 'right' | 'left' | 'up';
const FLY: Record<Decision, Fly> = { mine: 'right', 'not-mine': 'left', unsure: 'up' };
const IDENTITY_LABEL = { mine: 'Mine', 'not-mine': 'Not mine', unsure: 'Unsure', awaiting: 'Not reviewed' } as const;
const SWIPE_THRESHOLD = 110;

function Legend() {
  const rows: [Parameters<typeof Icon>[0]['name'], string, string][] = [
    ['check-circle', 'API-confirmed', 'GitHub or Bluesky’s public API returned this exact username. Not proof it’s yours.'],
    ['external', 'Open to check', 'A link we built but didn’t check. Not a found account.'],
    ['search', 'Search shortcut', 'Opens that site’s own search.'],
    ['dash-circle', 'Not found by API', 'No account for that exact username.'],
    ['pause', 'Unable to check', 'We couldn’t ask. Not a result either way.'],
  ];
  return (
    <details className="legend">
      <summary>
        <Icon name="info" size={15} /> What the labels mean <Icon name="chevron" size={14} className="chev" />
      </summary>
      <dl>
        {rows.map(([icon, term, def]) => (
          <div key={term}>
            <dt>
              <Icon name={icon} size={15} /> {term}
            </dt>
            <dd>{def}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"], dialog[open]'));
}

export function ReviewStep() {
  const { state, dispatch } = useSession();
  const run = state.run;
  const items = useMemo(() => reviewable(state), [state]);
  const notFound = run?.candidates.filter((c) => c.kind === 'api' && state.lookups[c.id]?.status === 'not-found') ?? [];

  // The cursor is tracked by id so it survives items dropping out (e.g. a check returning "not found").
  const [cursorId, setCursorId] = useState<string | null>(() => {
    const firstOpen = items.find((c) => identityOf(c, state) === 'awaiting');
    return firstOpen?.id ?? (items.length ? null : null);
  });
  const [done, setDone] = useState(() => items.length > 0 && items.every((c) => identityOf(c, state) !== 'awaiting'));
  const lastIndex = useRef(0);
  const [ghost, setGhost] = useState<{ candidate: Candidate; fly: Fly; key: number } | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  let index = cursorId ? items.findIndex((c) => c.id === cursorId) : -1;
  if (index === -1 && !done) index = Math.min(lastIndex.current, items.length - 1);
  if (index >= 0) lastIndex.current = index;
  const current = !done && index >= 0 ? items[index] : undefined;

  const goTo = useCallback(
    (i: number) => {
      if (i >= items.length) {
        setDone(true);
        setCursorId(null);
      } else {
        setDone(false);
        setCursorId(items[Math.max(0, i)].id);
      }
    },
    [items],
  );

  const advance = useCallback(
    (from: Candidate, fly: Fly) => {
      setGhost({ candidate: from, fly, key: Date.now() });
      const i = items.findIndex((c) => c.id === from.id);
      // Prefer the next card still awaiting review; otherwise just the next one.
      const rest = items.slice(i + 1);
      const nextOpen = rest.find((c) => identityOf(c, state) === 'awaiting');
      if (nextOpen) setCursorId(nextOpen.id);
      else goTo(i + 1);
    },
    [items, state, goTo],
  );

  const decide = useCallback(
    (d: Decision) => {
      if (!current) return;
      dispatch({ type: 'identity', id: current.id, value: d });
      // "Mine" stays on screen so the optional checklist can be answered.
      if (d !== 'mine') advance(current, FLY[d]);
    },
    [current, dispatch, advance],
  );

  const next = useCallback(() => {
    if (current) advance(current, identityOf(current, state) === 'mine' ? 'right' : 'left');
  }, [current, advance, state]);

  // When the front card changes, bring the deck into view and move focus to the new card.
  const frontKey = current?.id ?? (done ? 'end' : '');
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const deck = deckRef.current;
    if (!deck) return;
    const top = deck.getBoundingClientRect().top;
    if (top < 90 && typeof window.scrollBy === 'function') window.scrollBy({ top: top - 100, behavior: 'smooth' });
    deck.querySelector<HTMLElement>('.deck-front article, .deck-front .end-card')?.focus({ preventScroll: true });
  }, [frontKey]);

  // Clear the flying card once its animation has had time to finish.
  useEffect(() => {
    if (!ghost) return;
    const t = setTimeout(() => setGhost(null), 520);
    return () => clearTimeout(t);
  }, [ghost]);

  // Keyboard: ← not mine, ↑ unsure, → mine, Backspace to go back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (!current) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (identityOf(current, state) === 'mine') next();
        else decide('mine');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        decide('not-mine');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        decide('unsure');
      } else if (e.key === 'Backspace' && index > 0) {
        e.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, decide, next, goTo, index, state]);

  // Swipe (touch/pen/mouse drag on the card background).
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a, button, input, label, summary, details[open]')) return;
    dragStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = dragStart.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!drag && Math.abs(dx) < 8) return;
    if (!drag && Math.abs(dy) > Math.abs(dx)) {
      dragStart.current = null; // vertical: let the page scroll
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x: dx, y: dy * 0.2 });
  };
  const endDrag = () => {
    const d = drag;
    dragStart.current = null;
    setDrag(null);
    if (!d) return;
    if (d.x > SWIPE_THRESHOLD) decide('mine');
    else if (d.x < -SWIPE_THRESHOLD) decide('not-mine');
  };

  if (!run) return null;
  const c = counts(state);
  const decided = items.filter((x) => identityOf(x, state) !== 'awaiting').length;
  const behind = current ? items.slice(index + 1, index + 3) : [];
  const dragHint = drag ? (drag.x > 30 ? 'mine' : drag.x < -30 ? 'not-mine' : null) : null;

  return (
    <div className="step enter review">
      <header className="review-head">
        <h1 tabIndex={-1} data-step-heading>
          Which of these are you?
        </h1>
        <p className="lede">One at a time. Same username ≠ same person.</p>
      </header>

      {items.length > 0 && (
        <nav className="deck-dots" aria-label="Cards">
          <ol>
            {items.map((it, i) => {
              const id = identityOf(it, state);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    className={`dot dot-${id}${it.id === current?.id ? ' is-current' : ''}`}
                    aria-label={`${platformName(it.platform)} ${cardTitle(it)}: ${IDENTITY_LABEL[id]}`}
                    aria-current={it.id === current?.id ? 'true' : undefined}
                    onClick={() => goTo(i)}
                  />
                </li>
              );
            })}
          </ol>
          <span className="deck-count" role="status">
            {decided}/{items.length}
            {c.apiChecking > 0 ? ' · checking…' : ''}
          </span>
        </nav>
      )}

      {items.length === 0 ? (
        <div className="empty deck-empty">
          <h2>Nothing to review</h2>
          <p>
            {notFound.length
              ? 'The automatic checks found no accounts for these usernames, and no other platforms were selected.'
              : 'Those usernames don’t fit the rules of the platforms you picked.'}{' '}
            That says nothing about your wider footprint.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'start' })}>
            <Icon name="arrow-left" /> Edit
          </button>
        </div>
      ) : (
        <div className="deck-wrap">
          <div className="deck" ref={deckRef}>
            {current ? (
              <>
                {behind
                  .slice()
                  .reverse()
                  .map((b) => {
                    const depth = items.indexOf(b) - index;
                    return (
                      <div key={b.id} className={`deck-slot deck-behind depth-${depth}`} aria-hidden="true" inert>
                        <CandidateCard candidate={b} interactive={false} />
                      </div>
                    );
                  })}
                <div
                  key={current.id}
                  className={`deck-slot deck-front${drag ? ' is-dragging' : ''}${dragHint ? ` hint-${dragHint}` : ''}`}
                  style={drag ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 22}deg)` } : undefined}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <CandidateCard
                    candidate={current}
                    position={`${index + 1} / ${items.length}`}
                    onDecide={decide}
                    onNext={next}
                  />
                </div>
              </>
            ) : (
              <div className="deck-slot deck-front deck-end">
                <div className="card end-card" tabIndex={-1}>
                  <Icon name="check-circle" size={40} />
                  <h2 className="card-handle">All reviewed</h2>
                  <p>
                    {c.confirmed} mine · {c.unsure} unsure · {c.notMine} not mine
                  </p>
                  <div className="card-actions">
                    <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'step', step: 'summary' })}>
                      See my summary <Icon name="arrow-right" className="icon-go" />
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => goTo(0)}>
                      <Icon name="refresh" size={15} /> Go through again
                    </button>
                  </div>
                </div>
              </div>
            )}
            {ghost && (
              <div key={ghost.key} className={`deck-slot deck-ghost fly-${ghost.fly}`} aria-hidden="true" inert>
                <CandidateCard candidate={ghost.candidate} interactive={false} />
              </div>
            )}
          </div>

          <div className="deck-nav">
            <button type="button" className="btn btn-ghost btn-sm" disabled={index <= 0 && !done} onClick={() => goTo(done ? items.length - 1 : index - 1)}>
              <Icon name="arrow-left" size={15} /> Back
            </button>
            <span className="deck-hint">
              <span className="hint-keys">← not mine · ↑ unsure · → mine</span>
              <span className="hint-touch">Swipe → mine · ← not mine</span>
            </span>
            {current && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(index + 1)}>
                Skip <Icon name="arrow-right" size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="review-extras">
        {notFound.length > 0 && (
          <p className="skipped">
            <Icon name="dash-circle" size={14} /> Not found by API:{' '}
            {notFound.map((n) => `${platformName(n.platform)} ${cardTitle(n)}`).join(', ')} — this exact username only.
          </p>
        )}
        {run.linkErrors.length > 0 && (
          <p className="skipped">
            <Icon name="info" size={14} /> Left out {run.linkErrors.length === 1 ? 'a pasted link' : `${run.linkErrors.length} pasted links`}:{' '}
            {run.linkErrors.map((e) => e.reason).join(' ')}
          </p>
        )}
        {run.skipped.length > 0 && (
          <p className="skipped">
            <Icon name="info" size={14} /> Skipped where the username breaks the platform’s rules:{' '}
            {[...new Set(run.skipped.map((s) => platformName(s.platform)))].join(', ')}.
          </p>
        )}
        {run.webSearches.length > 0 && (
          <p className="skipped">
            <Icon name="search" size={14} />
            <span>
              Also try the wider web:{' '}
              {run.webSearches.map((w) => (
                <ExternalLink key={w.id} href={w.url} className="text-link">
                  {w.query} on DuckDuckGo
                </ExternalLink>
              ))}
            </span>
          </p>
        )}
        <Legend />
      </div>

      <div className="step-footer">
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'step', step: 'start' })}>
          <Icon name="arrow-left" /> Edit
        </button>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'step', step: 'summary' })}>
          See my summary <Icon name="arrow-right" className="icon-go" />
        </button>
      </div>
    </div>
  );
}
