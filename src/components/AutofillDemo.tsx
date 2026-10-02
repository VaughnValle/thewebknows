import { useRef, useState } from 'react';
import { Icon } from './Icon';

const HIDDEN_FIELDS: { name: string; autocomplete: string; label: string }[] = [
  { name: 'name', autocomplete: 'name', label: 'Full name' },
  { name: 'email', autocomplete: 'email', label: 'Email' },
  { name: 'tel', autocomplete: 'tel', label: 'Phone' },
  { name: 'street-address', autocomplete: 'street-address', label: 'Address' },
  { name: 'postal-code', autocomplete: 'postal-code', label: 'Postcode' },
  { name: 'organization', autocomplete: 'organization', label: 'Organisation' },
];

/** Live demo: a visible field can hide extra fields that your browser's autofill will quietly complete. */
export function AutofillDemo() {
  const formRef = useRef<HTMLFormElement>(null);
  const [captured, setCaptured] = useState<{ label: string; value: string }[] | null>(null);

  const check = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const got = HIDDEN_FIELDS.map((f) => ({ label: f.label, value: String(data.get(f.name) ?? '').trim() })).filter((f) => f.value);
    setCaptured(got);
  };

  const reset = () => {
    formRef.current?.reset();
    setCaptured(null);
  };

  return (
    <>
      <p className="report-blurb">
        A form can show one harmless field while hiding others. If you let your browser autofill the visible one, it can fill the
        hidden ones too, handing over details you never saw. Try it: click the field and choose a saved profile.
      </p>

      {/* The visible field looks innocent; the others are off-screen but still autofilled. */}
      <form ref={formRef} className="autofill-form" onSubmit={(e) => e.preventDefault()} aria-label="Autofill demonstration">
        <label className="field">
          <span className="field-label">Your email, to continue</span>
          <input className="input" type="email" name="email-visible" autoComplete="email" placeholder="you@example.com" />
        </label>
        <div className="autofill-hidden" aria-hidden="true">
          {HIDDEN_FIELDS.map((f) => (
            <input key={f.name} tabIndex={-1} name={f.name} autoComplete={f.autocomplete} />
          ))}
        </div>
        <div className="card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={check}>
            Show what a hidden form could have captured
          </button>
          {captured && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Clear
            </button>
          )}
        </div>
      </form>

      {captured && (
        <div className="demo-result" aria-live="polite">
          {captured.length === 0 ? (
            <p className="demo-ok">
              <Icon name="check-circle" size={18} /> Nothing was captured. You didn’t use autofill, or your browser didn’t fill the
              hidden fields. That’s the safe outcome.
            </p>
          ) : (
            <>
              <p className="demo-alert">
                <Icon name="info" size={18} /> A hidden form just received {captured.length === 1 ? 'this detail' : 'these details'} from your autofill:
              </p>
              <dl className="photo-list">
                {captured.map((c) => (
                  <div key={c.label}>
                    <dt>{c.label}</dt>
                    <dd>{c.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="small muted">This never left your browser. A real attacker’s form would send it on submit.</p>
            </>
          )}
        </div>
      )}
      <details className="demo-learn">
        <summary>
          How to limit it <Icon name="chevron" size={14} className="chev" />
        </summary>
        <p>Turn off form autofill for addresses and payment details in your browser settings, or keep it but never submit forms on sites you don’t trust. Password managers that fill only the field you click are safer than built-in profile autofill.</p>
      </details>
    </>
  );
}
