import { useMemo, useState, type FormEvent } from 'react';
import { Constellation } from './Constellation';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { useSession } from '../session/SessionContext';
import { MAX_DISPLAY_NAME, MAX_LINKS, MAX_USERNAMES, splitUsernamesAndLinks } from '../lib/platforms/candidates';
import { PLATFORMS } from '../lib/platforms/directory';
import { parseProfileLink } from '../lib/platforms/parseLink';
import { PLATFORM_ORDER, type PlatformId, type PrivacyGoal } from '../lib/types';

const GOALS: { value: PrivacyGoal; label: string }[] = [
  { value: 'personal-details', label: 'Fewer personal details' },
  { value: 'old-posts', label: 'Old posts' },
  { value: 'professional', label: 'Stay professional' },
  { value: 'curious', label: 'Just curious' },
];

const HEADLINE = ['Find', 'out', 'what', 'your', 'public', 'profiles'];

export function StartStep() {
  const { state, dispatch, startRun } = useSession();
  const { input } = state;
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => splitUsernamesAndLinks(input.usernamesText, input.linksText), [input.usernamesText, input.linksText]);
  const linkPreview = useMemo(() => parsed.links.slice(0, MAX_LINKS).map(parseProfileLink), [parsed.links]);
  const linkPlatforms = linkPreview.flatMap((l) => (l.ok ? [l.platform] : []));
  const lit = PLATFORM_ORDER.filter((p) => input.platforms.includes(p) || linkPlatforms.includes(p));
  const apiSelected = lit.filter((p) => PLATFORMS[p].check === 'api');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = startRun();
    setError(res.ok ? null : res.message ?? null);
  };

  const chip = (p: PlatformId) => {
    const checked = input.platforms.includes(p);
    return (
      <label key={p} className={`platform-chip${checked ? ' is-checked' : ''}`}>
        <input type="checkbox" checked={checked} onChange={() => dispatch({ type: 'togglePlatform', platform: p })} />
        <Icon name={checked ? 'check' : 'plus'} size={15} />
        <span>{PLATFORMS[p].name}</span>
        {PLATFORMS[p].check === 'api' && (
          <span className="api-tag" title="Checked automatically with a public API">
            API
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="start enter">
      <section className="start-hero">
        <h1 tabIndex={-1} data-step-heading className="hero-title">
          {HEADLINE.map((w, i) => (
            <span key={w} className="w" style={{ ['--i' as string]: i }}>
              {w}&nbsp;
            </span>
          ))}
          <em className="w" style={{ ['--i' as string]: HEADLINE.length }}>
            reveal.
          </em>
        </h1>
        <ul className="promise" aria-label="The basics">
          <li>
            <Icon name="user" size={16} /> No account
          </li>
          <li>
            <Icon name="lock" size={16} /> Nothing saved
          </li>
          <li>
            <Icon name="leaf" size={16} /> Free
          </li>
        </ul>
        <Constellation selected={lit} />
      </section>

      <form className="start-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="usernames" className="field-label">
            Your usernames
          </label>
          <input
            id="usernames"
            className="input input-xl"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="janedoe, jane.codes"
            value={input.usernamesText}
            aria-describedby="usernames-help"
            onChange={(e) => dispatch({ type: 'input', patch: { usernamesText: e.target.value } })}
          />
          <p className="field-help" id="usernames-help">
            Up to {MAX_USERNAMES}, separated by commas.
          </p>
          {parsed.usernames.length > 0 && (
            <ul className="chip-row" aria-label="Usernames to check">
              {parsed.usernames.slice(0, MAX_USERNAMES).map((u) => (
                <li key={u} className="chip">
                  @{u}
                </li>
              ))}
            </ul>
          )}
          {parsed.usernames.length > MAX_USERNAMES && (
            <p className="field-note">
              <Icon name="info" size={15} /> Only the first {MAX_USERNAMES} are used.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="links" className="field-label">
            Profile links <span className="optional">optional</span>
          </label>
          <textarea
            id="links"
            className="input textarea"
            rows={2}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={'Paste links, one per line — best for Facebook & LinkedIn'}
            value={input.linksText}
            onChange={(e) => dispatch({ type: 'input', patch: { linksText: e.target.value } })}
          />
          {linkPreview.length > 0 && (
            <ul className="link-preview" aria-label="Pasted links">
              {linkPreview.map((l, i) =>
                l.ok ? (
                  <li key={i}>
                    <Icon name="check" size={15} />
                    <span>
                      {PLATFORMS[l.platform].name} <strong>@{l.handle}</strong>
                    </span>
                  </li>
                ) : (
                  <li key={i} className="link-preview-bad">
                    <Icon name="x" size={15} />
                    <span>{l.reason}</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <div className="field">
          <label htmlFor="display-name" className="field-label">
            Name <span className="optional">optional · a search aid, not proof of identity</span>
          </label>
          <input
            id="display-name"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={MAX_DISPLAY_NAME}
            placeholder="Jane Doe"
            value={input.displayName}
            onChange={(e) => dispatch({ type: 'input', patch: { displayName: e.target.value } })}
          />
        </div>

        <fieldset className="field">
          <legend className="field-label">Platforms</legend>
          <div className="platform-row">{PLATFORM_ORDER.map(chip)}</div>
          <p className="field-help">API ones are checked automatically. The rest, you open and review.</p>
        </fieldset>

        <div className="field">
          <Segmented
            legend="Focus (optional)"
            options={GOALS}
            value={input.goal}
            allowDeselect
            onChange={(goal) => dispatch({ type: 'input', patch: { goal } })}
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            <Icon name="info" size={16} /> {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-xl">
          Check my footprint <Icon name="arrow-right" className="icon-go" />
        </button>

        <details className="disclosure">
          <summary>
            <Icon name="shield" size={16} /> What gets sent where <Icon name="chevron" size={16} className="chev" />
          </summary>
          <ul>
            {apiSelected.includes('github') && (
              <li>
                Usernames go from your browser to <span className="mono">api.github.com</span>.
              </li>
            )}
            {apiSelected.includes('bluesky') && (
              <li>
                Handles go from your browser to <span className="mono">public.api.bsky.app</span>.
              </li>
            )}
            {apiSelected.length > 0 && <li>Those services see your IP address, like any website.</li>}
            <li>Other platforms aren't contacted — you open their links yourself.</li>
            <li>No server, no analytics, no cookies. Everything stays in this tab.</li>
          </ul>
        </details>
      </form>
    </div>
  );
}
