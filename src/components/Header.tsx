import { useRef } from 'react';
import { Icon } from './Icon';
import { ClearButton, ExportPanel } from './SessionTools';
import { Stepper } from './Stepper';
import { useSession } from '../session/SessionContext';

export function Logo() {
  return (
    <svg className="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g className="logo-orbit">
        <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 3.4" />
        <circle cx="16" cy="3" r="2.4" fill="currentColor" />
      </g>
      <circle cx="16" cy="16" r="5.5" fill="currentColor" />
    </svg>
  );
}

const STEP_PROGRESS = { start: 0.12, review: 0.55, summary: 1 } as const;

export function Header() {
  const { state } = useSession();
  const exportRef = useRef<HTMLDialogElement>(null);
  const hasSession = Boolean(state.run) || Boolean(state.input.usernamesText || state.input.linksText || state.input.displayName);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#main" className="brand" aria-label="The Web Knows Me, home">
          <Logo />
          <span className="brand-name">
            thewebknows<em>.me</em>
          </span>
        </a>
        <Stepper />
        <div className="header-tools" aria-label="Session">
          {state.run && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportRef.current?.showModal()}>
              <Icon name="download" size={15} /> <span className="hide-xs">Export</span>
            </button>
          )}
          {hasSession && <ClearButton className="btn btn-ghost btn-sm" label="Clear" />}
        </div>
      </div>
      <span className="header-progress" style={{ width: `${STEP_PROGRESS[state.step] * 100}%` }} aria-hidden="true" />
      <dialog ref={exportRef} className="dialog" aria-labelledby="export-title">
        <h2 id="export-title">Export</h2>
        <ExportPanel />
        <div className="card-actions">
          <button type="button" className="btn btn-ghost" onClick={() => exportRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </header>
  );
}
