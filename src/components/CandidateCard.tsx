import { useEffect, useState } from 'react';
import { Checklist } from './Checklist';
import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
import { Segmented } from './Segmented';
import { RetrievalBadge } from './StatusBadge';
import { useSession } from '../session/SessionContext';
import { PLATFORMS, platformName } from '../lib/platforms/directory';
import { isNumericFacebookId } from '../lib/platforms/handles';
import { displayRetrieval, identityOf } from '../lib/report/summary';
import { formatClock } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { IdentityStatus } from '../lib/types';

const IDENTITY_OPTIONS: { value: Exclude<IdentityStatus, 'awaiting'>; label: string; icon: IconName }[] = [
  { value: 'mine', label: 'Mine', icon: 'check' },
  { value: 'not-mine', label: 'Not mine', icon: 'x' },
  { value: 'unsure', label: 'Unsure', icon: 'question' },
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

function title(c: Candidate): string {
  if (c.kind === 'search') return `“${c.query}”`;
  if (c.platform === 'facebook' && c.handle && isNumericFacebookId(c.handle)) return `ID ${c.handle}`;
  return `@${c.handle}`;
}

function basisText(c: Candidate): string {
  if (c.basis === 'pasted-link') return 'From your pasted link';
  if (c.kind === 'search') return 'Search shortcut — results aren’t found accounts';
  if (PLATFORMS[c.platform].ambiguous) return 'Guess — only if this is your custom URL';
  return 'From your username';
}

function IdentityPicker({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const value = identityOf(candidate, state);
  return (
    <Segmented
      legend={candidate.kind === 'search' ? 'Found yours?' : 'Is this yours?'}
      options={IDENTITY_OPTIONS}
      value={value === 'awaiting' ? null : value}
      allowDeselect
      onChange={(v) => dispatch({ type: 'identity', id: candidate.id, value: v ?? 'awaiting' })}
    />
  );
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

function ApiBody({ candidate }: { candidate: Candidate }) {
  const { state, recheck, dispatch } = useSession();
  const lookup = state.lookups[candidate.id];
  const name = platformName(candidate.platform);
  const retryAt = lookup?.status === 'unable' ? lookup.retryAt : undefined;
  const now = useNow(Boolean(retryAt));
  const markOpened = () => dispatch({ type: 'opened', id: candidate.id });
  const mine = identityOf(candidate, state) === 'mine';

  if (!lookup || lookup.status === 'checking') {
    return (
      <div className="card-body" aria-busy="true">
        <p>Asking {name}’s public API…</p>
        <div className="scanline" aria-hidden="true" />
      </div>
    );
  }

  if (lookup.status === 'not-found') {
    return (
      <div className="card-body">
        <p>No account with this username.</p>
        <p className="card-soft">Covers only this exact username — not your wider footprint.</p>
      </div>
    );
  }

  if (lookup.status === 'unable') {
    const waiting = retryAt !== undefined && now < retryAt;
    return (
      <div className="card-body">
        <p>{lookup.detail}</p>
        <p className="card-soft">This isn’t a result either way. Check it yourself:</p>
        <div className="card-actions">
          <ExternalLink href={candidate.url} onOpen={markOpened} className="btn btn-secondary btn-sm">
            Open to check
          </ExternalLink>
          <button type="button" className="btn btn-ghost btn-sm" disabled={waiting} onClick={() => recheck(candidate)}>
            <Icon name="refresh" size={15} /> {waiting && retryAt ? `Retry after ${formatClock(retryAt)}` : 'Try again'}
          </button>
        </div>
        <IdentityPicker candidate={candidate} />
        {mine && <Checklist candidate={candidate} />}
      </div>
    );
  }

  const { profile, observations } = lookup;
  const shown = observations.filter((o) => !o.label.startsWith('Bio may'));
  const hints = observations.filter((o) => o.label.startsWith('Bio may'));
  return (
    <div className="card-body">
      <p>
        This username exists{profile.facts.length ? ` · ${profile.facts.join(' · ')}` : ''}. Only you know if it’s yours.
      </p>
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
        <p className="card-soft">
          <Icon name="info" size={14} /> Bio may include {hints.map((h) => (h.category === 'contact' ? 'contact details' : 'a link')).join(' and ')}.
        </p>
      )}
      <details className="about">
        <summary>
          About this data <Icon name="chevron" size={14} className="chev" />
        </summary>
        {profile.notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </details>
      <div className="card-actions">
        <ExternalLink href={candidate.url} onOpen={markOpened} className="btn btn-secondary btn-sm">
          View on {name}
        </ExternalLink>
      </div>
      <IdentityPicker candidate={candidate} />
      {mine && <Checklist candidate={candidate} />}
    </div>
  );
}

function LinkBody({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const isSearch = candidate.kind === 'search';
  const mine = identityOf(candidate, state) === 'mine';
  return (
    <div className="card-body">
      <p className="url-line">
        <Icon name={isSearch ? 'search' : 'link'} size={15} />
        <span className="mono">{displayUrl(candidate.url)}</span>
      </p>
      <div className="card-actions">
        <ExternalLink
          href={candidate.url}
          onOpen={() => dispatch({ type: 'opened', id: candidate.id })}
          className="btn btn-secondary btn-sm"
        >
          Open to check
        </ExternalLink>
        {state.opened[candidate.id] && (
          <span className="card-soft">
            <Icon name="check" size={14} /> Opened
          </span>
        )}
      </div>
      <IdentityPicker candidate={candidate} />
      {mine && !isSearch && <Checklist candidate={candidate} />}
      {mine && isSearch && <p className="card-soft">Found it? Paste its link on step 1 to review it properly.</p>}
    </div>
  );
}

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const { state } = useSession();
  const retrieval = displayRetrieval(candidate, state);
  const identity = identityOf(candidate, state);
  const badge = candidate.kind === 'search' && retrieval === 'candidate' ? 'search' : retrieval;
  const stateClass = retrieval === 'not-found' ? 'state-none' : `state-${identity}`;
  const stamp = STAMP[identity];

  return (
    <article
      className={`card ${stateClass}${retrieval === 'checking' ? ' is-checking' : ''}`}
      aria-label={`${platformName(candidate.platform)}: ${title(candidate)}`}
    >
      <div className="card-top">
        <span className="card-platform">{platformName(candidate.platform)}</span>
        {stamp ? (
          <span className="state-stamp" key={identity}>
            <Icon name={stamp.icon} size={14} /> {stamp.label}
          </span>
        ) : null}
      </div>
      <div>
        <h3 className="card-handle">{title(candidate)}</h3>
        <p className="card-sub">{basisText(candidate)}</p>
      </div>
      <div aria-live="polite">
        <RetrievalBadge status={badge} />
      </div>
      {candidate.kind === 'api' ? <ApiBody candidate={candidate} /> : <LinkBody candidate={candidate} />}
    </article>
  );
}
