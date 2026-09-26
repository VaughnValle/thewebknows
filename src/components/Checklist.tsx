import { Segmented } from './Segmented';
import { useSession } from '../session/SessionContext';
import { CHECKLIST } from '../lib/report/checklist';
import { apiObservations } from '../lib/report/provenance';
import { platformName } from '../lib/platforms/directory';
import type { Candidate } from '../lib/platforms/candidates';
import type { ChecklistAnswer } from '../lib/types';

const ANSWERS: { value: ChecklistAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'skip', label: 'Not sure' },
];

/** Optional yes/no observations. Never asks for the actual value. */
export function Checklist({ candidate }: { candidate: Candidate }) {
  const { state, dispatch } = useSession();
  const answers = state.checklist[candidate.id] ?? {};
  const observed = apiObservations(state.lookups[candidate.id]);
  const answered = Object.keys(answers).length;

  return (
    <details className="checklist" open={answered > 0 || undefined}>
      <summary>
        <span>Optional: a few yes/no questions</span>
        <span className="checklist-count">{answered > 0 ? `${answered} of ${CHECKLIST.length} answered` : 'About a minute'}</span>
      </summary>
      <p className="checklist-intro">
        Answer while you look at the profile. We only record yes or no — never the details themselves.
      </p>
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
                  {platformName(candidate.platform)}'s API returned: {hint.map((h) => h.label).join(', ')}.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
