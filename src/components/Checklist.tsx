import { useState } from 'react';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { useSession } from '../session/SessionContext';
import { CHECKLIST } from '../lib/report/checklist';
import { apiObservations } from '../lib/report/provenance';
import type { Candidate } from '../lib/platforms/candidates';
import type { ChecklistAnswer } from '../lib/types';

const ANSWERS: { value: ChecklistAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'skip', label: 'Not sure' },
];

/** Optional yes/no observations. Never asks for the actual value. */
export function Checklist({ candidate, inline }: { candidate: Candidate; inline?: boolean }) {
  const { state, dispatch } = useSession();
  const answers = state.checklist[candidate.id] ?? {};
  const observed = apiObservations(state.lookups[candidate.id]);
  const answered = Object.keys(answers).length;

  const list = (
      <ol className="checklist-list">
        {CHECKLIST.map((q) => {
          const hint = observed.filter((o) => q.apiCategories.includes(o.category));
          return (
            <li key={q.id} className="checklist-item">
              <Segmented
                legend={q.question}
                size="sm"
                options={ANSWERS}
                value={answers[q.id]}
                allowDeselect
                onChange={(answer) => dispatch({ type: 'checklist', id: candidate.id, question: q.id, answer })}
              />
              {hint.length > 0 && (
                <p className="checklist-hint">
                  API shows: {hint.map((h) => h.label).join(', ')}
                </p>
              )}
            </li>
          );
        })}
      </ol>
  );

  if (inline) return <StepChecklist candidate={candidate} />;

  return (
    <details className="checklist" open={answered > 0 || undefined}>
      <summary>
        <span>Optional: a few yes/no questions</span>
        <span className="checklist-count">{answered > 0 ? `${answered}/${CHECKLIST.length}` : 'yes/no only'}</span>
        <Icon name="chevron" size={16} className="chev" />
      </summary>
      {list}
    </details>
  );
}

const SHORT_ANSWER: Record<ChecklistAnswer, string> = { yes: 'Yes', no: 'No', skip: 'Not sure' };

/** Deck version: one question at a time, answers collapse into chips you can revisit. */
function StepChecklist({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const answers = state.checklist[candidate.id] ?? {};
  const observed = apiObservations(state.lookups[candidate.id]);
  const firstOpen = () => {
    const i = CHECKLIST.findIndex((q) => !answers[q.id]);
    return i === -1 ? CHECKLIST.length : i;
  };
  const [qi, setQi] = useState(firstOpen);
  const q = CHECKLIST[qi];
  const hint = q ? observed.filter((o) => q.apiCategories.includes(o.category)) : [];

  const answer = (a: ChecklistAnswer | null) => {
    if (!q || !a) return;
    dispatch({ type: 'checklist', id: candidate.id, question: q.id, answer: a });
    const after = CHECKLIST.findIndex((x, i) => i > qi && !answers[x.id]);
    setQi(after === -1 ? CHECKLIST.length : after);
  };

  const answered = CHECKLIST.filter((x) => answers[x.id]);

  return (
    <section className="checklist checklist-inline" aria-label="Optional yes/no questions">
      <p className="checklist-title">
        <span>{q ? 'Quick check (optional)' : 'All answered, thanks'}</span>
        <span className="checklist-count">
          {Math.min(qi + 1, CHECKLIST.length)}/{CHECKLIST.length}
        </span>
      </p>
      {q && (
        <div className="step-q" key={q.id}>
          <Segmented legend={q.question} options={ANSWERS} value={answers[q.id]} onChange={answer} />
          {hint.length > 0 && <p className="checklist-hint">API shows: {hint.map((h) => h.label).join(', ')}</p>}
        </div>
      )}
      {answered.length > 0 && (
        <ul className="answer-chips" aria-label="Your answers">
          {answered.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className={`answer-chip${CHECKLIST[qi]?.id === x.id ? ' is-current' : ''}`}
                onClick={() => setQi(CHECKLIST.indexOf(x))}
                aria-label={`${x.field}: ${SHORT_ANSWER[answers[x.id]!]}. Change`}
              >
                {x.field}: <strong>{SHORT_ANSWER[answers[x.id]!]}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
