import { useState } from 'react';
import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
import { PlatformLogo } from './PlatformLogo';
import { Segmented } from './Segmented';
import { ProvenanceBadge, RetrievalBadge } from './StatusBadge';
import { SessionTools } from './SessionTools';
import { useCountUp } from './useCountUp';
import { useSession } from '../session/SessionContext';
import { GUIDES, platformName } from '../lib/platforms/directory';
import { isNumericFacebookId } from '../lib/platforms/handles';
import { fieldRows } from '../lib/report/provenance';
import {
  counts,
  displayRetrieval,
  guideFor,
  mineCandidates,
  nextFixes,
  unansweredMine,
  usernameReuse,
  type GuideKey,
} from '../lib/report/summary';
import { formatDate } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { ProfilePlan } from '../lib/session/state';

const PLAN_OPTIONS: { value: ProfilePlan; label: string; icon: IconName }[] = [
  { value: 'keep', label: 'Keep public', icon: 'check' },
  { value: 'edit', label: 'Edit', icon: 'pencil' },
  { value: 'delete', label: 'Review deletion', icon: 'trash' },
];

const GUIDE_BUTTONS: { key: GuideKey; label: string }[] = [
  { key: 'editProfile', label: 'Edit profile' },
  { key: 'privacy', label: 'Privacy settings' },
  { key: 'oldPosts', label: 'Old posts' },
  { key: 'deletion', label: 'Deletion instructions' },
];

function profileTitle(c: Candidate) {
  if (c.kind === 'search') return `via “${c.query}”`;
  if (c.platform === 'facebook' && c.handle && isNumericFacebookId(c.handle)) return `ID ${c.handle}`;
  return `@${c.handle}`;
}

function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value);
  return (
    <li className="stat">
      <span className="stat-num" aria-hidden="true">
        {shown}
      </span>
      <span className="stat-label">
        <span className="visually-hidden">{value} </span>
        {label}
      </span>
    </li>
  );
}

function DoneToggle({ id, label }: { id: string; label: string }) {
  const { state, dispatch } = useSession();
  const done = Boolean(state.done[id]);
  return (
    <label className={`done-toggle${done ? ' is-done' : ''}`}>
      <input type="checkbox" checked={done} onChange={(e) => dispatch({ type: 'done', actionId: id, value: e.target.checked })} />
      <span className="done-box" aria-hidden="true">
        {done && <Icon name="check" size={14} />}
      </span>
      <span>{done ? 'Done' : label}</span>
    </label>
  );
}

function ProfileCard({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const rows = fieldRows(candidate, state);
  const plan = state.plans[candidate.id];
  const guide = GUIDES[candidate.platform];

  return (
    <article className="card profile-card" aria-labelledby={`pc-${candidate.id}`}>
      <div className="card-top">
        <span className="card-platform card-platform-logo">
          <PlatformLogo platform={candidate.platform} size={22} />
          {platformName(candidate.platform)}
        </span>
        <RetrievalBadge status={displayRetrieval(candidate, state)} />
      </div>
      <h3 id={`pc-${candidate.id}`} className="card-handle">
        {profileTitle(candidate)}
      </h3>

      <dl className="fields">
        {rows.map((r) => {
          const values = r.apiValues.filter((v) => !v.label.startsWith('Bio may'));
          return (
            <div key={r.question} className="field-row">
              <dt>{r.field}</dt>
              <dd>
                <ProvenanceBadge provenance={r.provenance} />
              </dd>
              {r.provenance === 'api' && (
                <span className="field-values">
                  {values.length ? values.map((v) => v.value).join(' · ') : 'Possibly in the bio'}
                </span>
              )}
              {r.conflict && <span className="field-values">You said no, but the API returned something. Worth a look.</span>}
            </div>
          );
        })}
      </dl>

      <Segmented
        legend="Your plan"
        options={PLAN_OPTIONS}
        value={plan}
        allowDeselect
        onChange={(p) => dispatch({ type: 'plan', id: candidate.id, plan: p })}
      />
      {plan === 'keep' && <p className="plan-note">Good call if it’s meant to be found, like a portfolio or work profile.</p>}
      {plan === 'delete' && (
        <p className="plan-note">
          Deleting can remove things you want to keep. Download your data first, or consider deactivating. This site never
          deletes anything for you.
        </p>
      )}

      <div className="guide-links">
        {GUIDE_BUTTONS.map((b) => {
          const g = guideFor(candidate.platform, b.key);
          if (!g) return null;
          return (
            <ExternalLink key={b.key} href={g.url} className="text-link">
              {b.label}
            </ExternalLink>
          );
        })}
      </div>
      <p className="guide-meta">Official help pages · reviewed {formatDate(guide.lastReviewed)}</p>
      {plan && plan !== 'keep' && <DoneToggle id={`profile:${candidate.id}`} label="I’ve made my changes" />}
    </article>
  );
}

export function SummaryStep() {
  const { state, dispatch } = useSession();
  const [showProfiles, setShowProfiles] = useState(false);
  const c = counts(state);
  const mine = mineCandidates(state);
  const fixes = nextFixes(state);
  const reuse = usernameReuse(state);
  const unanswered = unansweredMine(state);

  return (
    <div className="step enter summary">
      <header className="summary-head">
        <h1 tabIndex={-1} data-step-heading>
          Your next steps.
        </h1>
        <ul className="summary-stats" aria-label="Counts">
          <Stat value={c.confirmed} label={c.confirmed === 1 ? 'profile confirmed' : 'profiles confirmed'} />
          <Stat value={c.awaiting + c.unsure} label="still to review" />
          <Stat value={Object.keys(state.done).length} label="done" />
        </ul>
      </header>

      {mine.length === 0 ? (
        <div className="empty summary-empty">
          <h2>Nothing confirmed yet</h2>
          <p>That doesn’t mean you have no footprint. Nothing has been marked Mine in this session yet.</p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'review' })}>
            <Icon name="arrow-left" /> Back to review
          </button>
        </div>
      ) : (
        <>
          <section className="fixes" aria-labelledby="fixes-h">
            <h2 id="fixes-h" className="visually-hidden">
              Suggested fixes
            </h2>
            {fixes.length === 0 ? (
              <div className="empty summary-empty">
                <h2>Nothing stands out</h2>
                <p>
                  {unanswered.length > 0
                    ? `Answer the quick check for ${unanswered.map((u) => platformName(u.platform)).join(', ')} to get suggestions.`
                    : 'Based on your answers, there’s nothing to fix right now.'}
                </p>
                {unanswered.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'step', step: 'review' })}>
                    <Icon name="arrow-left" size={15} /> Back to review
                  </button>
                )}
              </div>
            ) : (
              <ol className="fix-list">
                {fixes.map((f, i) => (
                  <li key={f.id} className={`fix${state.done[f.id] ? ' is-done' : ''}`} style={{ ['--i' as string]: i }}>
                    {(f.platform || f.platforms) && (
                      <p className="fix-platforms">
                        {(f.platforms ?? [f.platform!]).map((p) => (
                          <span key={p} className="fix-platform">
                            <PlatformLogo platform={p} size={18} />
                            {platformName(p)}
                          </span>
                        ))}
                      </p>
                    )}
                    <h3>{f.title}</h3>
                    <p className="fix-why">{f.why}</p>
                    <div className="card-actions">
                      {f.guide && (
                        <ExternalLink href={f.guide.url} className="btn btn-primary btn-sm">
                          {f.guide.label}
                        </ExternalLink>
                      )}
                      {f.goTo === 'review' && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'step', step: 'review' })}>
                          Go to review
                        </button>
                      )}
                      <DoneToggle id={f.id} label="Mark done" />
                    </div>
                    <p className="fix-basis">
                      <Icon name={f.basis === 'API-confirmed' ? 'check-circle' : 'user'} size={13} /> Based on: {f.basis}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {reuse.length > 0 && (
              <>
                <h2 id="reuse-h" className="visually-hidden">
                  Username reuse
                </h2>
                {reuse.map((g) => (
                  <p key={g.handle} className="reuse">
                    <span className="reuse-logos">
                      {g.platforms.map((p) => (
                        <PlatformLogo key={p} platform={p} size={18} />
                      ))}
                    </span>
                    <span>
                      <strong>{g.handle}</strong> is yours on {g.platforms.map(platformName).join(' and ')}. A reused handle makes
                      them easier to link together. That’s fine if you want them connected.
                    </span>
                  </p>
                ))}
              </>
            )}
          </section>

          <section className="profiles-toggle-wrap" aria-label="Confirmed profiles">
            <button
              type="button"
              className="btn btn-ghost profiles-toggle"
              aria-expanded={showProfiles}
              aria-controls="confirmed-profiles"
              onClick={() => setShowProfiles((v) => !v)}
            >
              <Icon name={showProfiles ? 'eye-off' : 'eye'} size={16} />
              {showProfiles ? 'Hide' : 'Show'} confirmed profiles ({mine.length})
            </button>
            {showProfiles && (
              <div id="confirmed-profiles" className="profiles-panel">
                <p className="small muted">
                  <strong>API-confirmed</strong> means the platform’s public API returned it. <strong>You marked this public</strong>{' '}
                  is your own answer. We don’t verify it.
                </p>
                <div className="card-grid">
                  {mine.map((cand, i) => (
                    <div key={cand.id} className="card-cell" style={{ ['--i' as string]: i }}>
                      <ProfileCard candidate={cand} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <SessionTools />
    </div>
  );
}
