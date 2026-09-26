import { useSession } from '../session/SessionContext';
import type { Step } from '../lib/session/state';

const STEPS: { id: Step; label: string }[] = [
  { id: 'start', label: 'Your handles' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
];

export function Stepper() {
  const { state, dispatch } = useSession();
  const current = STEPS.findIndex((s) => s.id === state.step);
  return (
    <nav className="stepper" aria-label="Progress">
      <ol>
        {STEPS.map((s, i) => {
          const enabled = s.id === 'start' || Boolean(state.run);
          const isCurrent = i === current;
          return (
            <li key={s.id} className={`${isCurrent ? 'is-current' : ''}${i < current ? ' is-past' : ''}`}>
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => dispatch({ type: 'step', step: s.id })}
              >
                <span className="stepper-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
