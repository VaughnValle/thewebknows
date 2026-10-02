import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { useDevice } from '../session/DeviceContext';
import { useSession } from '../session/SessionContext';
import { browserFixes } from '../lib/device/report';
import { resourceUrl } from '../lib/platforms/safeUrl';

/** Browser-level suggestions, based on what this browser actually shared. */
export function BrowserFixes() {
  const { signals, who } = useDevice();
  const { state, dispatch } = useSession();
  const fixes = browserFixes(signals, who);
  if (!fixes.length) return null;

  return (
    <section className="browser-fixes" aria-labelledby="browser-fixes-h">
      <h2 id="browser-fixes-h" className="section-title">
        <Icon name="monitor" size={20} /> Your browser
      </h2>
      <ul>
        {fixes.map((f) => {
          const url = resourceUrl(f.link.url);
          const done = Boolean(state.done[f.id]);
          return (
            <li key={f.id} className={`browser-fix${done ? ' is-done' : ''}`}>
              <div>
                <h3>{f.title}</h3>
                <p>{f.why}</p>
              </div>
              <div className="card-actions">
                {url && (
                  <ExternalLink href={url} className="btn btn-secondary btn-sm">
                    {f.link.label}
                  </ExternalLink>
                )}
                <label className={`done-toggle${done ? ' is-done' : ''}`}>
                  <input type="checkbox" checked={done} onChange={(e) => dispatch({ type: 'done', actionId: f.id, value: e.target.checked })} />
                  <span className="done-box" aria-hidden="true">
                    {done && <Icon name="check" size={14} />}
                  </span>
                  <span>{done ? 'Done' : 'Mark done'}</span>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
