import { useRef } from 'react';
import { Icon } from './Icon';
import { ClearButton, ExportPanel } from './SessionTools';
import { useSession } from '../session/SessionContext';

export function Logo() {
  return (
    <svg className="logo-mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 3.2" />
      <circle cx="16" cy="16" r="5.2" fill="currentColor" />
      <circle cx="16" cy="3" r="2.2" className="logo-dot" />
      <circle cx="27.3" cy="22.5" r="2.2" className="logo-dot" />
      <circle cx="4.7" cy="22.5" r="2.2" className="logo-dot" />
    </svg>
  );
}

export function Header() {
  const { state } = useSession();
  const exportRef = useRef<HTMLDialogElement>(null);
  const hasSession = Boolean(state.run) || Boolean(state.input.usernamesText || state.input.linksText || state.input.displayName);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#main" className="brand" aria-label="The Web Knows Me — home">
          <Logo />
          <span className="brand-name">
            the web knows <em>me</em>
          </span>
        </a>
        {hasSession && (
          <div className="header-tools" aria-label="Session">
            {state.run && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportRef.current?.showModal()}>
                <Icon name="download" size={16} /> <span className="hide-xs">Export</span>
              </button>
            )}
            <ClearButton className="btn btn-ghost btn-sm" label="Clear" />
          </div>
        )}
      </div>
      <dialog ref={exportRef} className="dialog" aria-labelledby="export-title">
        <h2 id="export-title">Export your checklist</h2>
        <ExportPanel />
        <div className="card-actions dialog-close">
          <button type="button" className="btn btn-ghost" onClick={() => exportRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </header>
  );
}
