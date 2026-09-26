import { useEffect, useState } from 'react';
import { Checklist } from './Checklist';
import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { RetrievalBadge } from './StatusBadge';
import { useSession } from '../session/SessionContext';
import { PLATFORMS, platformName } from '../lib/platforms/directory';
import { isNumericFacebookId } from '../lib/platforms/handles';
import { displayRetrieval, identityOf } from '../lib/report/summary';
import { formatClock } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { IdentityStatus } from '../lib/types';

const IDENTITY_OPTIONS: { value: Exclude<IdentityStatus, 'awaiting'>; label: string; icon: 'check' | 'x' | 'question' }[] = [
  { value: 'mine', label: 'Mine', icon: 'check' },
  { value: 'not-mine', label: 'Not mine', icon: 'x' },
  { value: 'unsure', label: 'Unsure', icon: 'question' },
];

function displayUrl(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${decodeURIComponent(u.pathname)}${u.search ? decodeURIComponent(u.search) : ''}`.replace(/\/$/, '');
}

function title(c: Candidate): string {
  if (c.kind === 'search') return `Search ${platformName(c.platform)} for “${c.query}”`;
  if (c.platform === 'facebook' && c.handle && isNumericFacebookId(c.handle)) return `Facebook profile ${c.handle}`;
  return `@${c.handle}`;
}

function basisText(c: Candidate): string {
  if (c.basis === 'pasted-link') return 'From a link you pasted';
  if (c.kind === 'search') return c.basis === 'display-name' ? 'Built from the name you entered' : 'Built from your username';
  if (PLATFORMS[c.platform].ambiguous) return 'A guess from your username — it only matches if you chose this as your custom profile address';
  return 'Built from your username';
}

function IdentityPicker({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const value = identityOf(candidate, state);
  return (
    <Segmented
      legend={candidate.kind === 'search' ? 'Did this lead you to a profile of yours?' : 'Is this yours?'}
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

  if (!lookup || lookup.status === 'checking') {
    return (
      <div className="api-loading" aria-busy="true">
        <p>
          Asking {name}'s public API about <strong>@{candidate.handle}</strong>…
        </p>
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (lookup.status === 'not-found') {
    return (
      <div className="api-body">
        <p>{lookup.detail}</p>
        <p className="muted small">
          This covers only this exact username on {name}. It isn't a statement about the rest of your footprint.
        </p>
      </div>
    );
  }

  if (lookup.status === 'unable') {
    const waiting = retryAt !== undefined && now < retryAt;
    return (
      <div className="api-body">
        <p>{lookup.detail}</p>
        <p className="muted small">This isn't a result either way — we just couldn't ask. You can check it yourself instead:</p>
        <div className="card-actions">
          <ExternalLink href={candidate.url} onOpen={markOpened}>
            Open to check
          </ExternalLink>
          <button type="button" className="btn btn-ghost" disabled={waiting} onClick={() => recheck(candidate)}>
            <Icon name="refresh" size={16} /> {waiting && retryAt ? `Retry after ${formatClock(retryAt)}` : 'Try again'}
          </button>
        </div>
        <IdentityPicker candidate={candidate} />
        {identityOf(candidate, state) === 'mine' && <Checklist candidate={candidate} />}
      </div>
    );
  }

  const { profile, observations } = lookup;
  return (
    <div className="api-body">
      <p>
        {name}'s public API returned an account named <strong>@{profile.handle}</strong>. That shows the username exists — only
        you can say whether it's yours.
      </p>
      <div className="api-profile">
        {(profile.displayName || profile.facts.length > 0) && (
          <p className="api-profile-head">
            {profile.displayName && <strong>{profile.displayName}</strong>}
            {profile.facts.length > 0 && <span className="muted"> · {profile.facts.join(' · ')}</span>}
          </p>
        )}
        {observations.length > 0 ? (
          <dl className="observations">
            {observations
              .filter((o) => !o.label.startsWith('Bio may'))
              .map((o, i) => (
                <div key={i} className="observation">
                  <dt>{o.label}</dt>
                  <dd>{o.value}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="muted small">The API returned no name, bio, location or links for this account.</p>
        )}
        {observations.some((o) => o.label.startsWith('Bio may')) && (
          <p className="small">
            <Icon name="info" size={14} /> The bio may include{' '}
            {observations
              .filter((o) => o.label.startsWith('Bio may'))
              .map((o) => (o.category === 'contact' ? 'contact details' : 'a link'))
              .join(' and ')}{' '}
            — worth a look.
          </p>
        )}
        {profile.notes.map((n, i) => (
          <p key={i} className="muted small">
            {n}
          </p>
        ))}
      </div>
      <div className="card-actions">
        <ExternalLink href={candidate.url} onOpen={markOpened}>
          View on {name}
        </ExternalLink>
      </div>
      <IdentityPicker candidate={candidate} />
      {identityOf(candidate, state) === 'mine' && <Checklist candidate={candidate} />}
    </div>
  );
}

function LinkBody({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const opened = state.opened[candidate.id];
  const isSearch = candidate.kind === 'search';
  return (
    <div className="api-body">
      <p className="url-line">
        <Icon name={isSearch ? 'search' : 'link'} size={16} />
        <span className="mono">{displayUrl(candidate.url)}</span>
      </p>
      <p className="muted small">
        {isSearch
          ? `Opens ${platformName(candidate.platform)}'s own search. Results are yours to look through — they aren't found accounts, and ${platformName(candidate.platform)} will see the search terms.`
          : `We haven't checked this link. It may show someone else, a login screen, or nothing at all.`}
      </p>
      <div className="card-actions">
        <ExternalLink href={candidate.url} onOpen={() => dispatch({ type: 'opened', id: candidate.id })}>
          Open to check
        </ExternalLink>
        {opened && (
          <span className="opened-note">
            <Icon name="check" size={14} /> Opened
          </span>
        )}
      </div>
      <IdentityPicker candidate={candidate} />
      {identityOf(candidate, state) === 'mine' && candidate.kind !== 'search' && <Checklist candidate={candidate} />}
      {identityOf(candidate, state) === 'mine' && candidate.kind === 'search' && (
        <p className="small muted">
          Tip: if you found your profile, paste its link on the first step so it gets its own card and checklist.
        </p>
      )}
    </div>
  );
}

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const { state } = useSession();
  const retrieval = displayRetrieval(candidate, state);
  const identity = identityOf(candidate, state);
  const badge = candidate.kind === 'search' && retrieval === 'candidate' ? 'search' : retrieval;

  return (
    <article className={`candidate candidate-${candidate.kind} identity-${identity}`} aria-label={`${platformName(candidate.platform)}: ${title(candidate)}`}>
      <header className="candidate-head">
        <div>
          <h3 className="candidate-title">{title(candidate)}</h3>
          <p className="candidate-basis">{basisText(candidate)}</p>
        </div>
        <div aria-live="polite">
          <RetrievalBadge status={badge} />
        </div>
      </header>
      {candidate.kind === 'api' ? <ApiBody candidate={candidate} /> : <LinkBody candidate={candidate} />}
    </article>
  );
}
