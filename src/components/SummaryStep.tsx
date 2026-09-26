import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
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
      <span>{done ? 'Done (you reported)' : label}</span>
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
        <span className="card-platform">{platformName(candidate.platform)}</span>
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
              {r.conflict && <span className="field-values">You said no, but the API returned something — worth a look.</span>}
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
      {plan === 'keep' && <p className="plan-note">Good call if it’s meant to be found — a portfolio or work profile.</p>}
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
  const c = counts(state);
  const mine = mineCandidates(state);
  const fixes = nextFixes(state);
  const reuse = usernameReuse(state);
  const unanswered = unansweredMine(state);
  const apiTotal = c.apiReturned + c.apiNotFound + c.apiUnable + c.apiChecking;

  return (
    <div className="step enter">
      <header className="step-header">
        <h1 tabIndex={-1} data-step-heading>
          Your footprint.
        </h1>
        <p className="lede">From API results and your own answers, this session only.</p>
      </header>

      <div className="step-header">
        <ul className="stat-row" aria-label="Counts">
          <Stat value={c.confirmed} label={c.confirmed === 1 ? 'profile you confirmed' : 'profiles you confirmed'} />
          <Stat value={c.awaiting + c.unsure} label="awaiting review or unsure" />
          <Stat value={c.selectedActions} label={c.selectedActions === 1 ? 'privacy action selected' : 'privacy actions selected'} />
        </ul>
        {apiTotal > 0 && (
          <p className="api-line">
            Automatic checks: {c.apiReturned} returned · {c.apiNotFound} not found · {c.apiUnable} unable to check
            {c.apiChecking > 0 ? ` · ${c.apiChecking} running` : ''}
          </p>
        )}
      </div>

      {mine.length === 0 ? (
        <div className="empty">
          <h2>Nothing confirmed yet</h2>
          <p>That doesn’t mean you have no footprint — only that nothing’s been marked Mine in this session.</p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'review' })}>
            <Icon name="arrow-left" /> Back to review
          </button>
        </div>
      ) : (
        <div className="summary-grid">
          <section className="summary-col" aria-labelledby="fixes-h">
            <h2 id="fixes-h">{['Next fixes', 'Your next fix', 'Your next two fixes', 'Your next three fixes'][fixes.length]}</h2>
            {fixes.length === 0 ? (
              <div className="empty">
                <p>
                  Nothing stands out
                  {unanswered.length > 0
                    ? `. Answer the checklist for ${unanswered.map((u) => platformName(u.platform)).join(', ')} for suggestions.`
                    : ' from your answers.'}
                </p>
                {unanswered.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'step', step: 'review' })}>
                    <Icon name="arrow-left" size={15} /> Answer the checklist
                  </button>
                )}
              </div>
            ) : (
              <ol className="fix-list">
                {fixes.map((f, i) => (
                  <li key={f.id} className={`fix${state.done[f.id] ? ' is-done' : ''}`} style={{ ['--i' as string]: i }}>
                    <h3>{f.title}</h3>
                    <p className="fix-basis">
                      <Icon name={f.basis === 'API-confirmed' ? 'check-circle' : 'user'} size={13} /> {f.basis}
                    </p>
                    <div className="card-actions">
                      {f.guide && (
                        <ExternalLink href={f.guide.url} className="btn btn-secondary btn-sm">
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
                    <Icon name="link" size={16} />
                    <span>
                      <strong>{g.handle}</strong> is yours on {g.platforms.map(platformName).join(' and ')}. A reused handle makes
                      them easier to link together — fine if that’s what you want.
                    </span>
                  </p>
                ))}
              </>
            )}
          </section>

          <section className="summary-col" aria-labelledby="footprint-h">
            <h2 id="footprint-h" className="section-title">
              Confirmed profiles <span className="count">{mine.length}</span>
            </h2>
            <div className="card-grid">
              {mine.map((cand, i) => (
                <div key={cand.id} className="card-cell" style={{ ['--i' as string]: i }}>
                  <ProfileCard candidate={cand} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <SessionTools />
    </div>
  );
}
