import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { ProvenanceBadge, RetrievalBadge } from './StatusBadge';
import { SessionTools } from './SessionTools';
import { useSession } from '../session/SessionContext';
import { GUIDES, GUIDES_REVIEW_NOTE, platformName } from '../lib/platforms/directory';
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
import { formatDate, plural } from '../lib/format';
import type { Candidate } from '../lib/platforms/candidates';
import type { ProfilePlan } from '../lib/session/state';

const PLAN_OPTIONS: { value: ProfilePlan; label: string; icon: 'check' | 'pencil' | 'trash' }[] = [
  { value: 'keep', label: 'Keep public', icon: 'check' },
  { value: 'edit', label: 'Edit', icon: 'pencil' },
  { value: 'delete', label: 'Review deletion', icon: 'trash' },
];

const GUIDE_BUTTONS: { key: GuideKey; label: string }[] = [
  { key: 'editProfile', label: 'Edit profile' },
  { key: 'privacy', label: 'Review privacy settings' },
  { key: 'oldPosts', label: 'Review old posts' },
  { key: 'deletion', label: 'Account-deletion instructions' },
];

function profileTitle(c: Candidate) {
  if (c.kind === 'search') return `found via search for “${c.query}”`;
  if (c.platform === 'facebook' && c.handle && isNumericFacebookId(c.handle)) return `profile ${c.handle}`;
  return `@${c.handle}`;
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
  const name = platformName(candidate.platform);

  return (
    <article className="profile-card" aria-labelledby={`pc-${candidate.id}`}>
      <header className="candidate-head">
        <div>
          <h3 id={`pc-${candidate.id}`} className="candidate-title">
            {name} <span className="muted">{profileTitle(candidate)}</span>
          </h3>
        </div>
        <RetrievalBadge status={displayRetrieval(candidate, state)} />
      </header>

      <table className="fields">
        <caption className="visually-hidden">What this profile shows, and how we know</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.question}>
              <th scope="row">{r.field}</th>
              <td>
                <ProvenanceBadge provenance={r.provenance} />
                {r.apiValues.length > 0 && (
                  <span className="field-values">
                    {r.apiValues
                      .filter((v) => !v.label.startsWith('Bio may'))
                      .map((v) => `${v.label}: ${v.value}`)
                      .join(' · ') || 'Possibly in the bio text'}
                  </span>
                )}
                {r.conflict && <span className="field-values">You answered no, but the API returned something — worth a look.</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Segmented
        legend="What do you want to do with this profile?"
        options={PLAN_OPTIONS}
        value={plan}
        allowDeselect
        onChange={(p) => dispatch({ type: 'plan', id: candidate.id, plan: p })}
      />
      {plan === 'keep' && (
        <p className="small muted">Fine choice — some profiles, like a portfolio or work account, are meant to be found.</p>
      )}
      {plan === 'delete' && (
        <div className="notice notice-soft">
          <Icon name="info" />
          <p>
            Deleting an account can also remove things you want to keep, like photos, messages or followers. Most platforms let
            you download your data first, and some offer a temporary deactivation instead. Take your time — this site doesn't
            delete or change anything for you.
          </p>
        </div>
      )}

      <div className="guide-links">
        {GUIDE_BUTTONS.map((b) => {
          const g = guideFor(candidate.platform, b.key);
          if (!g) return null;
          const primary = (plan === 'delete' && b.key === 'deletion') || (plan === 'edit' && b.key === 'editProfile');
          return (
            <ExternalLink key={b.key} href={g.url} className={`btn ${primary ? 'btn-secondary' : 'btn-ghost'} btn-sm`}>
              {b.label}
            </ExternalLink>
          );
        })}
      </div>
      <p className="guide-meta">
        Official {name} help pages · last reviewed {formatDate(guide.lastReviewed)}
        {guide.note ? ` · ${guide.note}` : ''}
      </p>
      {plan && plan !== 'keep' && <DoneToggle id={`profile:${candidate.id}`} label="I've made my changes here" />}
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
    <div className="step step-summary">
      <header className="step-header">
        <p className="eyebrow">Step 3 of 3</p>
        <h1 tabIndex={-1} data-step-heading>
          Your footprint summary
        </h1>
        <p className="lede">
          Based only on what the public APIs returned and what you told us in this session. Nothing is saved.
        </p>
      </header>

      <ul className="stat-row" aria-label="Counts">
        <li className="stat">
          <span className="stat-num">{c.confirmed}</span>
          <span className="stat-label">{c.confirmed === 1 ? 'profile you confirmed' : 'profiles you confirmed'}</span>
        </li>
        <li className="stat">
          <span className="stat-num">{c.awaiting + c.unsure}</span>
          <span className="stat-label">{c.awaiting + c.unsure === 1 ? 'profile' : 'profiles'} awaiting review or unsure</span>
        </li>
        <li className="stat">
          <span className="stat-num">{c.selectedActions}</span>
          <span className="stat-label">{c.selectedActions === 1 ? 'selected privacy action' : 'selected privacy actions'}</span>
        </li>
      </ul>
      {apiTotal > 0 && (
        <p className="muted small api-line">
          Automatic checks: {c.apiReturned} returned by API · {c.apiNotFound} not found · {c.apiUnable} unable to check
          {c.apiChecking > 0 ? ` · ${c.apiChecking} still running` : ''}.
        </p>
      )}

      {mine.length === 0 ? (
        <div className="empty">
          <Icon name="eye" size={28} />
          <h2>No profiles confirmed yet</h2>
          <p>
            You haven't marked anything as yours in this session. That doesn't mean you have no footprint — only that nothing has
            been confirmed here. Go back, open a few links, and mark the ones that are yours.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'step', step: 'review' })}>
            <Icon name="arrow-left" /> Back to review
          </button>
        </div>
      ) : (
        <>
          <section className="summary-section" aria-labelledby="fixes-h">
            <h2 id="fixes-h">{['Your next fixes', 'Your next fix', 'Your next two fixes', 'Your next three fixes'][fixes.length]}</h2>
            {fixes.length === 0 ? (
              <div className="empty empty-inline">
                <p>
                  Nothing stands out from your answers
                  {unanswered.length > 0
                    ? `. Answer the short checklist for ${unanswered.map((u) => platformName(u.platform)).join(', ')} to get tailored suggestions.`
                    : ' — nice.'}
                </p>
                {unanswered.length > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'step', step: 'review' })}>
                    <Icon name="arrow-left" /> Answer the checklist
                  </button>
                )}
              </div>
            ) : (
              <ol className="fix-list">
                {fixes.map((f) => (
                  <li key={f.id} className={`fix${state.done[f.id] ? ' is-done' : ''}`}>
                    <h3>{f.title}</h3>
                    <p className="small">{f.why}</p>
                    <p className="fix-basis">
                      <Icon name={f.basis === 'API-confirmed' ? 'check-circle' : 'user'} size={14} /> Based on: {f.basis}
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
                      <DoneToggle id={f.id} label="Mark as done" />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {reuse.length > 0 && (
            <section className="summary-section" aria-labelledby="reuse-h">
              <h2 id="reuse-h">Username reuse</h2>
              {reuse.map((g) => (
                <p key={g.handle} className="reuse">
                  <Icon name="link" size={16} />
                  <span>
                    You confirmed <strong>{g.handle}</strong> on {g.platforms.map(platformName).join(' and ')}. A reused handle may
                    make these profiles easier to associate with each other. That's fine if you want them connected.
                  </span>
                </p>
              ))}
            </section>
          )}

          <section className="summary-section" aria-labelledby="footprint-h">
            <h2 id="footprint-h">Your confirmed footprint</h2>
            <p className="muted small">
              <strong>API-confirmed</strong> means the platform's public API returned it; what logged-out visitors see can
              differ. <strong>You marked this public</strong> is your own review — we don't verify it.
            </p>
            <div className="profile-list">
              {mine.map((cand) => (
                <ProfileCard key={cand.id} candidate={cand} />
              ))}
            </div>
            <p className="muted small">{GUIDES_REVIEW_NOTE}</p>
          </section>
        </>
      )}

      <section className="summary-section" aria-labelledby="session-h">
        <h2 id="session-h">Keep a copy, or clear it all</h2>
        <SessionTools />
      </section>

      {(c.awaiting > 0 || c.unsure > 0) && mine.length > 0 && (
        <p className="muted small">
          {plural(c.awaiting + c.unsure, 'item')} still awaiting review or marked unsure — they're not included above.
        </p>
      )}
    </div>
  );
}
