import { useEffect, useState } from 'react';
import { Checklist } from './Checklist';
import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
import { RetrievalBadge } from './StatusBadge';
import { useSession } from '../session/SessionContext';
import { PLATFORMS, platformName } from '../lib/platforms/directory';
import { isNumericFacebookId } from '../lib/platforms/handles';
import { displayRetrieval, identityOf } from '../lib/report/summary';
import { formatClock } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { IdentityStatus } from '../lib/types';

export type Decision = Exclude<IdentityStatus, 'awaiting'>;

export const DECISIONS: { value: Decision; label: string; icon: IconName; key: string }[] = [
  { value: 'not-mine', label: 'Not mine', icon: 'x', key: '←' },
  { value: 'unsure', label: 'Unsure', icon: 'question', key: '↑' },
  { value: 'mine', label: 'Mine', icon: 'check', key: '→' },
];

const STAMP: Partial<Record<IdentityStatus, { icon: IconName; label: string }>> = {
  mine: { icon: 'check', label: 'Mine' },
  unsure: { icon: 'question', label: 'Unsure' },
  'not-mine': { icon: 'x', label: 'Not mine' },
};

function displayUrl(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${decodeURIComponent(u.pathname)}${u.search ? decodeURIComponent(u.search) : ''}`.replace(/\/$/, '');
}

export function cardTitle(c: Candidate): string {
  if (c.kind === 'search') return `“${c.query}”`;
  if (c.platform === 'facebook' && c.handle && isNumericFacebookId(c.handle)) return `ID ${c.handle}`;
  return `@${c.handle}`;
}

function basisText(c: Candidate): string {
  if (c.basis === 'pasted-link') return 'From your pasted link';
  if (c.kind === 'search') return 'Search shortcut. Results aren’t found accounts';
  if (PLATFORMS[c.platform].ambiguous) return 'A guess. Only matches if this is your custom URL';
  return 'From your username';
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** The one or two lines that say what we know about this candidate. */
function StatusBlock({ candidate }: { candidate: Candidate }) {
  const { state, recheck } = useSession();
  const lookup = state.lookups[candidate.id];
  const name = platformName(candidate.platform);
  const retryAt = lookup?.status === 'unable' ? lookup.retryAt : undefined;
  const now = useNow(Boolean(retryAt));

  if (candidate.kind !== 'api') {
    return (
      <p className="url-line">
        <Icon name={candidate.kind === 'search' ? 'search' : 'link'} size={15} />
        <span className="mono">{displayUrl(candidate.url)}</span>
      </p>
    );
  }
  if (!lookup || lookup.status === 'checking') {
    return (
      <div className="card-body" aria-busy="true">
        <p>Asking {name}’s public API…</p>
        <div className="scanline" aria-hidden="true" />
      </div>
    );
  }
  if (lookup.status === 'not-found') {
    return <p>No account with this username. Covers only this exact username.</p>;
  }
  if (lookup.status === 'unable') {
    const waiting = retryAt !== undefined && now < retryAt;
    return (
      <div className="card-body">
        <p>{lookup.detail}</p>
        <p className="card-soft">This isn’t a result either way. Open it and check yourself.</p>
        <div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={waiting} onClick={() => recheck(candidate)}>
            <Icon name="refresh" size={15} /> {waiting && retryAt ? `Retry after ${formatClock(retryAt)}` : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  const { profile, observations } = lookup;
  const shown = observations.filter((o) => !o.label.startsWith('Bio may'));
  const hints = observations.filter((o) => o.label.startsWith('Bio may'));
  return (
    <div className="card-body">
      <p className="card-lead">
        {profile.displayName ? <strong>{profile.displayName}</strong> : 'This username exists'}
        {profile.facts.length > 0 && <span className="card-soft"> · {profile.facts.join(' · ')}</span>}
      </p>
      <details className="about">
        <summary>
          Details from the API <Icon name="chevron" size={14} className="chev" />
        </summary>
        {shown.length > 0 && (
          <dl className="observations">
            {shown.map((o, i) => (
              <div key={i} className="observation">
                <dt>{o.label}</dt>
                <dd>{o.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {hints.length > 0 && (
          <p>Bio may include {hints.map((h) => (h.category === 'contact' ? 'contact details' : 'a link')).join(' and ')}.</p>
        )}
        {profile.notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </details>
    </div>
  );
}

export function DecisionButtons({ current, onDecide }: { current: IdentityStatus; onDecide: (d: Decision) => void }) {
  return (
    <div className="decide" role="group" aria-label="Is this yours?">
      {DECISIONS.map((d) => (
        <button
          key={d.value}
          type="button"
          className={`decide-btn decide-${d.value}${current === d.value ? ' is-on' : ''}`}
          aria-pressed={current === d.value}
          onClick={() => onDecide(d.value)}
        >
          <Icon name={d.icon} size={20} />
          <span>{d.label}</span>
          <kbd aria-hidden="true">{d.key}</kbd>
        </button>
      ))}
    </div>
  );
}

/**
 * One card of the review deck. Only the front card is interactive; cards behind
 * it and the one flying away are rendered inert.
 */
export function CandidateCard({
  candidate,
  interactive = true,
  position,
  onDecide,
  onNext,
}: {
  candidate: Candidate;
  interactive?: boolean;
  position?: string;
  onDecide?: (d: Decision) => void;
  onNext?: () => void;
}) {
  const { state, dispatch } = useSession();
  const retrieval = displayRetrieval(candidate, state);
  const identity = identityOf(candidate, state);
  const badge = candidate.kind === 'search' && retrieval === 'candidate' ? 'search' : retrieval;
  const stamp = STAMP[identity];
  const name = platformName(candidate.platform);
  const apiReturned = state.lookups[candidate.id]?.status === 'api-returned';

  return (
    <article
      className={`card deck-card state-${identity}${retrieval === 'checking' ? ' is-checking' : ''}`}
      aria-label={`${name}: ${cardTitle(candidate)}`}
      tabIndex={interactive ? -1 : undefined}
    >
      <div className="card-top">
        <span className="card-platform">{name}</span>
        {stamp ? (
          <span className="state-stamp" key={identity}>
            <Icon name={stamp.icon} size={14} /> {stamp.label}
          </span>
        ) : (
          position && <span className="card-pos">{position}</span>
        )}
      </div>

      <div>
        <h2 className="card-handle">{cardTitle(candidate)}</h2>
        <p className="card-sub">{basisText(candidate)}</p>
      </div>

      <div aria-live={interactive ? 'polite' : undefined}>
        <RetrievalBadge status={badge} />
      </div>

      <StatusBlock candidate={candidate} />

      <div className="card-actions">
        <ExternalLink
          href={candidate.url}
          onOpen={() => dispatch({ type: 'opened', id: candidate.id })}
          className="btn btn-secondary"
        >
          {apiReturned ? `View on ${name}` : 'Open to check'}
        </ExternalLink>
        {state.opened[candidate.id] && (
          <span className="card-soft">
            <Icon name="check" size={14} /> Opened
          </span>
        )}
      </div>

      {onDecide && <DecisionButtons current={identity} onDecide={onDecide} />}

      {identity === 'mine' && interactive && (
        <div className="mine-panel">
          {candidate.kind === 'search' ? (
            <p className="card-soft">Found it? Paste its link on step 1 to review it properly.</p>
          ) : (
            <Checklist candidate={candidate} inline />
          )}
          {onNext && (
            <button type="button" className="btn btn-primary btn-next" onClick={onNext}>
              Next <Icon name="arrow-right" className="icon-go" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
