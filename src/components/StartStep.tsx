import { useMemo, useState, type FormEvent } from 'react';
import { Constellation } from './Constellation';
import { Icon } from './Icon';
import { RevealWord } from './RevealWord';
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
  const contacted = lit.filter((p) => PLATFORMS[p].check === 'api').map((p) => PLATFORMS[p].name);

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
      </label>
    );
  };

  return (
    <div className="start enter">
      <h1 tabIndex={-1} data-step-heading className="hero-title">
        {HEADLINE.map((w, i) => (
          <span key={w} className="w" style={{ ['--i' as string]: i }}>
            {w}&nbsp;
          </span>
        ))}
        <span className="w" style={{ ['--i' as string]: HEADLINE.length }}>
          <RevealWord word="reveal." />
        </span>
      </h1>

      <p className="hero-sub">Free. No account. Nothing saved.</p>

      <form className="start-form" onSubmit={submit} noValidate>
        <div className="search-bar">
          <label htmlFor="usernames" className="visually-hidden">
            Your usernames
          </label>
          <input
            id="usernames"
            className="search-input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Your usernames, e.g. janedoe"
            value={input.usernamesText}
            onChange={(e) => dispatch({ type: 'input', patch: { usernamesText: e.target.value } })}
          />
          <button type="submit" className="btn btn-primary search-go">
            Check my footprint <Icon name="arrow-right" className="icon-go" />
          </button>
        </div>

        {parsed.usernames.length > 0 && (
          <ul className="chip-row" aria-label="Usernames to check">
            {parsed.usernames.slice(0, MAX_USERNAMES).map((u) => (
              <li key={u} className="chip">
                @{u}
              </li>
            ))}
            {parsed.usernames.length > MAX_USERNAMES && <li className="field-note">first {MAX_USERNAMES} only</li>}
          </ul>
        )}

        {error && (
          <p className="form-error" role="alert">
            <Icon name="info" size={16} /> {error}
          </p>
        )}

        <p className="hero-note">
          {contacted.length > 0
            ? `Only ${contacted.join(' and ')} receive${contacted.length === 1 ? 's' : ''} your usernames, to check they exist. Everything else, you open yourself.`
            : 'Nothing is sent anywhere. You open each link yourself.'}
        </p>

        <details className="more-options">
          <summary>
            More options <Icon name="chevron" size={16} className="chev" />
          </summary>
          <div className="more-grid">
            <div className="field">
              <label htmlFor="links" className="field-label">
                Profile links
              </label>
              <textarea
                id="links"
                className="input textarea"
                rows={2}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Paste links to your profiles, one per line"
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
                Your name <span className="optional">for search shortcuts only, not proof of identity</span>
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
            </fieldset>

            <div className="field">
              <Segmented
                legend="What matters most?"
                options={GOALS}
                value={input.goal}
                allowDeselect
                onChange={(goal) => dispatch({ type: 'input', patch: { goal } })}
              />
            </div>
          </div>
        </details>
      </form>

      <Constellation selected={lit} />
    </div>
  );
}
