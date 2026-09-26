import { CandidateCard } from './CandidateCard';
import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { useSession } from '../session/SessionContext';
import { PLATFORMS, platformName } from '../lib/platforms/directory';
import { counts, reviewable } from '../lib/report/summary';
import { plural } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { PlatformId } from '../lib/types';

const PLATFORM_INTRO: Record<'api' | 'candidate' | 'ambiguous', string> = {
  api: 'Checked automatically with the public API.',
  candidate: 'Not checked automatically — open each link and decide.',
  ambiguous: 'Profile addresses here often differ from usernames, so a pasted link or a search works best.',
};

function Legend() {
  return (
    <details className="legend">
      <summary>
        <Icon name="info" size={16} /> What the labels mean
      </summary>
      <dl>
        <div>
          <dt>
            <Icon name="check-circle" size={16} /> API-confirmed
          </dt>
          <dd>A supported public API (GitHub or Bluesky) returned an account for that exact username. It doesn't mean it's yours.</dd>
        </div>
        <div>
          <dt>
            <Icon name="external" size={16} /> Open to check
          </dt>
          <dd>A link we built. We haven't checked it, and it isn't a found account.</dd>
        </div>
        <div>
          <dt>
            <Icon name="search" size={16} /> Search shortcut
          </dt>
          <dd>Opens that site's own search with your terms.</dd>
        </div>
        <div>
          <dt>
            <Icon name="dash-circle" size={16} /> Not found by API
          </dt>
          <dd>The API had no account for that exact username. Only covers that one check.</dd>
        </div>
        <div>
          <dt>
            <Icon name="pause" size={16} /> Unable to check right now
          </dt>
          <dd>We couldn't ask (limit reached, offline or blocked). Not a result either way.</dd>
        </div>
        <div>
          <dt>
            <Icon name="eye" size={16} /> You reviewed this
          </dt>
          <dd>You've marked it Mine, Not mine or Unsure.</dd>
        </div>
      </dl>
    </details>
  );
}

export function ReviewStep() {
  const { state, dispatch } = useSession();
  const run = state.run;
  if (!run) return null;

  const c = counts(state);
  // Progress covers possible profiles; search shortcuts are optional extras.
  const items = reviewable(state).filter((x) => x.kind !== 'search');
  const reviewed = items.length - c.awaiting;
  const byPlatform = new Map<PlatformId, Candidate[]>();
  for (const cand of run.candidates) {
    if (!byPlatform.has(cand.platform)) byPlatform.set(cand.platform, []);
    byPlatform.get(cand.platform)!.push(cand);
  }
  const skippedFor = (p: PlatformId) => run.skipped.filter((s) => s.platform === p);
  const emptyPlatforms = run.platforms.filter((p) => !byPlatform.has(p));

  return (
    <div className="step step-review">
      <header className="step-header">
        <p className="eyebrow">Step 2 of 3</p>
        <h1 tabIndex={-1} data-step-heading>
          Review your possible profiles
        </h1>
        <p className="lede">
          Nothing here counts as yours until you say so. Open each one, then choose <strong>Mine</strong>,{' '}
          <strong>Not mine</strong> or <strong>Unsure</strong>. A matching username doesn't mean it's the same person.
        </p>
        <Legend />
        {items.length > 0 && (
          <div className="progress" role="status">
            <div className="progress-bar" aria-hidden="true">
              <span style={{ width: `${items.length ? (reviewed / items.length) * 100 : 0}%` }} />
            </div>
            <p>
              {reviewed} of {plural(items.length, 'possible profile')} reviewed
              {c.apiChecking > 0 && ` · ${plural(c.apiChecking, 'automatic check')} still running`}
            </p>
          </div>
        )}
      </header>

      {run.linkErrors.length > 0 && (
        <div className="notice" role="note">
          <Icon name="info" />
          <div>
            <p>
              <strong>{plural(run.linkErrors.length, 'pasted link was', 'pasted links were')} left out:</strong>
            </p>
            <ul>
              {run.linkErrors.map((e, i) => (
                <li key={i}>
                  <span className="mono">{e.raw.length > 60 ? `${e.raw.slice(0, 57)}…` : e.raw}</span> — {e.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {run.candidates.length === 0 && (
        <div className="empty">
          <Icon name="info" size={28} />
          <h2>Nothing to review yet</h2>
          <p>
            None of the usernames fit the rules of the platforms you picked, so there were no links to build. That says nothing
            about your footprint — try another username, or paste a profile link.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'start' })}>
            <Icon name="arrow-left" /> Edit what you entered
          </button>
        </div>
      )}

      {[...byPlatform.entries()].map(([platform, list]) => {
        const def = PLATFORMS[platform];
        const mode = def.check === 'api' ? 'api' : def.ambiguous ? 'ambiguous' : 'candidate';
        return (
          <section key={platform} className="platform-section" aria-labelledby={`sec-${platform}`}>
            <header className="platform-section-head">
              <h2 id={`sec-${platform}`}>{def.name}</h2>
              <span className={`mode-tag mode-${def.check}`}>
                <Icon name={def.check === 'api' ? 'check-circle' : 'eye'} size={14} />
                {def.check === 'api' ? 'Automatic check' : 'You review'}
              </span>
            </header>
            <p className="platform-section-intro">{PLATFORM_INTRO[mode]}</p>
            <div className="candidate-list">
              {list.map((cand) => (
                <CandidateCard key={cand.id} candidate={cand} />
              ))}
            </div>
            {skippedFor(platform).length > 0 && (
              <p className="skipped">
                <Icon name="info" size={14} /> Skipped {skippedFor(platform).map((s) => `“${s.value}”`).join(', ')}:{' '}
                {skippedFor(platform)[0].reason}.
              </p>
            )}
          </section>
        );
      })}

      {emptyPlatforms.length > 0 && run.candidates.length > 0 && (
        <p className="skipped">
          <Icon name="info" size={14} /> No links for {emptyPlatforms.map(platformName).join(', ')} — your usernames don't fit their
          rules{emptyPlatforms.some((p) => PLATFORMS[p].searchUrl) ? ', and no name was entered for a search shortcut' : ''}.
        </p>
      )}

      {run.webSearches.length > 0 && (
        <section className="platform-section" aria-labelledby="sec-web">
          <header className="platform-section-head">
            <h2 id="sec-web">The wider web</h2>
            <span className="mode-tag mode-candidate">
              <Icon name="search" size={14} /> Search shortcut
            </span>
          </header>
          <p className="platform-section-intro">
            Opens a normal DuckDuckGo search in a new tab. DuckDuckGo will see the search terms. Anything you find there is for you
            to judge.
          </p>
          <div className="web-search-list">
            {run.webSearches.map((w) => (
              <ExternalLink key={w.id} href={w.url} className="btn btn-ghost">
                Search the web for {w.query}
              </ExternalLink>
            ))}
          </div>
        </section>
      )}

      <div className="step-footer">
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'step', step: 'start' })}>
          <Icon name="arrow-left" /> Edit
        </button>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'step', step: 'summary' })}>
          See my summary <Icon name="arrow-right" />
        </button>
      </div>
    </div>
  );
}
