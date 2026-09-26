import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { useSession } from '../session/SessionContext';
import { DEFAULT_EXPORT_OPTIONS, exportAsJson, exportAsText, type ExportOptions } from '../lib/report/export';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function ExportPanel() {
  const { state } = useSession();
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const set = (k: keyof ExportOptions) => (e: React.ChangeEvent<HTMLInputElement>) => setOpts({ ...opts, [k]: e.target.checked });
  const disabled = !state.run;

  return (
    <div className="export-panel">
      <p className="small">Saved to your device, never uploaded. It may contain personal info, so choose what goes in:</p>
      <div className="export-options">
        <label className="check">
          <input type="checkbox" checked={opts.includeHandles} onChange={set('includeHandles')} />
          <span>Usernames and profile links</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.includeApiValues} onChange={set('includeApiValues')} />
          <span>Values the APIs returned (name, location…)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.includeUnconfirmed} onChange={set('includeUnconfirmed')} />
          <span>Profiles not marked Mine</span>
        </label>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled}
          onClick={() => download(`thewebknows-checklist-${stamp()}.txt`, exportAsText(state, opts), 'text/plain;charset=utf-8')}
        >
          <Icon name="download" size={16} /> Download text
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() => download(`thewebknows-checklist-${stamp()}.json`, exportAsJson(state, opts), 'application/json')}
        >
          <Icon name="download" size={16} /> Download JSON
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => window.print()}>
          <Icon name="print" size={16} /> Print
        </button>
      </div>
    </div>
  );
}

export function ClearButton({ className = 'btn btn-danger btn-sm', label = 'Clear session' }: { className?: string; label?: string }) {
  const { clear } = useSession();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [cleared, setCleared] = useState(false);

  const confirm = () => {
    dialogRef.current?.close();
    clear();
    setCleared(true);
    window.scrollTo({ top: 0 });
    setTimeout(() => {
      document.querySelector<HTMLElement>('[data-step-heading]')?.focus();
      setCleared(false);
    }, 50);
  };

  return (
    <>
      <button type="button" className={className} onClick={() => dialogRef.current?.showModal()}>
        <Icon name="trash" size={16} /> {label}
      </button>
      <dialog ref={dialogRef} className="dialog" aria-labelledby="clear-title">
        <h2 id="clear-title">Clear this session?</h2>
        <p>Everything you entered and every answer disappears. Nothing is stored anywhere else by this site.</p>
        <p className="small muted">
          It can’t erase your browser history, downloaded files, or what sites you visited or checked may have logged.
        </p>
        <div className="card-actions">
          <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={confirm}>
            <Icon name="trash" size={16} /> Clear everything
          </button>
        </div>
      </dialog>
      <span className="visually-hidden" role="status">
        {cleared ? 'Session cleared.' : ''}
      </span>
    </>
  );
}

export function SessionTools() {
  return (
    <section className="session-bar" aria-labelledby="session-h">
      <div>
        <h2 id="session-h">Keep a copy</h2>
        <ExportPanel />
      </div>
      <div className="session-clear">
        <ClearButton className="btn btn-secondary" />
        <p className="small muted">Closing the tab clears it too.</p>
      </div>
    </section>
  );
}
