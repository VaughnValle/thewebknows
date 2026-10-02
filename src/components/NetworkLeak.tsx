import { useState } from 'react';
import { Icon } from './Icon';
import { findLocalAddresses, type LocalAddress } from '../lib/device/webrtc';

type State = { phase: 'idle' } | { phase: 'running' } | { phase: 'done'; found: LocalAddress[] };

/** Live demo: a page can learn your local network address through WebRTC, no permission asked. */
export function NetworkLeak() {
  const [state, setState] = useState<State>({ phase: 'idle' });

  const run = async () => {
    setState({ phase: 'running' });
    const found = await findLocalAddresses();
    setState({ phase: 'done', found });
  };

  const masked = state.phase === 'done' && state.found.length > 0 && state.found.every((a) => a.masked);

  return (
    <>
      <p className="report-blurb">
        Through WebRTC, a page can ask your browser for the address your device uses inside your own home or office network. No
        permission is requested. Nothing here is sent anywhere.
      </p>

      {state.phase === 'idle' && (
        <button type="button" className="btn btn-secondary" onClick={run}>
          <Icon name="wifi" size={16} /> Reveal my local address
        </button>
      )}
      {state.phase === 'running' && (
        <p className="demo-running" aria-live="polite">
          <Icon name="spinner" size={16} /> Asking your browser…
        </p>
      )}
      {state.phase === 'done' && (
        <div className="demo-result" aria-live="polite">
          {state.found.length === 0 ? (
            <p className="demo-ok">
              <Icon name="check-circle" size={18} /> Your browser didn’t hand out a local address. It may be blocking WebRTC, which
              is good for privacy.
            </p>
          ) : (
            <>
              <ul className="demo-addr">
                {state.found.map((a) => (
                  <li key={a.address}>
                    <span className="mono">{a.address}</span>
                    <span className="demo-tag">{a.kind}</span>
                  </li>
                ))}
              </ul>
              <p className="small muted">
                {masked
                  ? 'Your browser masks this as a random “.local” name, which limits what sites learn. Older browsers and some VPN setups leak the real address instead.'
                  : 'This is your real address on your local network. A site can use it to guess your router and probe devices around you.'}
              </p>
            </>
          )}
          <p className="small muted">
            A fuller “scan” of nearby devices is possible on plain, unprotected sites. This site can’t do it to you: its security
            policy only allows connections to itself and the two profile APIs.
          </p>
        </div>
      )}
      <details className="demo-learn">
        <summary>
          How to limit it <Icon name="chevron" size={14} className="chev" />
        </summary>
        <p>Brave and Tor Browser restrict this by default. In Firefox, set <span className="mono">media.peerConnection.enabled</span> to false. Extensions like uBlock Origin can block the WebRTC address leak.</p>
      </details>
    </>
  );
}
