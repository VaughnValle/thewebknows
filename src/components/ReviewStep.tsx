import { CandidateCard } from './CandidateCard';
import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { useSession } from '../session/SessionContext';
import { platformName } from '../lib/platforms/directory';
import { counts, reviewable } from '../lib/report/summary';

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

export function ReviewStep() {
  const { state, dispatch } = useSession();
  const run = state.run;
  if (!run) return null;

  const c = counts(state);
  const items = reviewable(state).filter((x) => x.kind !== 'search');
  const reviewed = items.length - c.awaiting;
  const skippedPlatforms = [...new Set(run.skipped.map((s) => s.platform))];

  return (
    <div className="step enter">
      <header className="step-header">
        <div className="step-header-row">
          <div className="step-header">
            <h1 tabIndex={-1} data-step-heading>
              Which of these
              <br />
              are you?
            </h1>
            <p className="lede">Open each one. Mark it Mine, Not mine or Unsure. Same username ≠ same person.</p>
          </div>
          {items.length > 0 && (
            <p className="review-count" role="status">
              {reviewed}
              <span>/{items.length}</span>
              <small>reviewed{c.apiChecking > 0 ? ` · ${c.apiChecking} checking` : ''}</small>
            </p>
          )}
        </div>
        <Legend />
      </header>

      {run.linkErrors.length > 0 && (
        <div className="notice" role="note">
          <Icon name="info" />
          <div>
            <strong>Left out {run.linkErrors.length === 1 ? 'a pasted link' : `${run.linkErrors.length} pasted links`}:</strong>
            <ul>
              {run.linkErrors.map((e, i) => (
                <li key={i}>
                  <span className="mono">{e.raw.length > 50 ? `${e.raw.slice(0, 47)}…` : e.raw}</span> — {e.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {run.candidates.length === 0 ? (
        <div className="empty">
          <h2>Nothing to review yet</h2>
          <p>
            Those usernames don’t fit the rules of the platforms you picked. That says nothing about your footprint — try another
            username or paste a profile link.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'start' })}>
            <Icon name="arrow-left" /> Edit
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {run.candidates.map((cand, i) => (
            <div key={cand.id} className="card-cell" style={{ ['--i' as string]: i }}>
              <CandidateCard candidate={cand} />
            </div>
          ))}
        </div>
      )}

      {skippedPlatforms.length > 0 && (
        <p className="skipped">
          <Icon name="info" size={14} /> Skipped where the username breaks the platform’s rules:{' '}
          {skippedPlatforms.map((p) => platformName(p)).join(', ')}.
        </p>
      )}

      {run.webSearches.length > 0 && (
        <div className="web-row">
          <span className="web-row-label">Search the wider web</span>
          {run.webSearches.map((w) => (
            <ExternalLink key={w.id} href={w.url} className="btn btn-ghost btn-sm">
              {w.query} on DuckDuckGo
            </ExternalLink>
          ))}
          <span className="small muted">DuckDuckGo sees the search terms.</span>
        </div>
      )}

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
