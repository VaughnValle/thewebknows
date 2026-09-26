import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { Segmented } from './Segmented';
import { useSession } from '../session/SessionContext';
import { MAX_DISPLAY_NAME, MAX_LINKS, MAX_USERNAMES, splitUsernamesAndLinks } from '../lib/platforms/candidates';
import { PLATFORMS } from '../lib/platforms/directory';
import { parseProfileLink } from '../lib/platforms/parseLink';
import { PLATFORM_ORDER, type PlatformId, type PrivacyGoal } from '../lib/types';

const GOALS: { value: PrivacyGoal; label: string }[] = [
  { value: 'personal-details', label: 'Share fewer personal details' },
  { value: 'old-posts', label: 'Clean up old posts' },
  { value: 'professional', label: 'Keep a professional presence' },
  { value: 'curious', label: 'Just curious' },
];

const API_PLATFORMS = PLATFORM_ORDER.filter((p) => PLATFORMS[p].check === 'api');
const REVIEW_PLATFORMS = PLATFORM_ORDER.filter((p) => PLATFORMS[p].check !== 'api');

const PLATFORM_NOTE: Partial<Record<PlatformId, string>> = {
  github: 'Public API',
  bluesky: 'Public API',
  facebook: 'Best with a pasted link',
  linkedin: 'Best with a pasted link',
};

export function StartStep() {
  const { state, dispatch, startRun } = useSession();
  const { input } = state;
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => splitUsernamesAndLinks(input.usernamesText, input.linksText), [input.usernamesText, input.linksText]);
  const linkPreview = useMemo(() => parsed.links.slice(0, MAX_LINKS).map(parseProfileLink), [parsed.links]);
  const tooManyUsernames = parsed.usernames.length > MAX_USERNAMES;
  const tooManyLinks = parsed.links.length > MAX_LINKS;

  const apiSelected = API_PLATFORMS.filter((p) => input.platforms.includes(p) || linkPreview.some((l) => l.ok && l.platform === p));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = startRun();
    setError(res.ok ? null : res.message ?? null);
  };

  const platformTile = (p: PlatformId) => {
    const checked = input.platforms.includes(p);
    return (
      <label key={p} className={`platform-tile${checked ? ' is-checked' : ''}`}>
        <input type="checkbox" checked={checked} onChange={() => dispatch({ type: 'togglePlatform', platform: p })} />
        <span className="platform-tile-box" aria-hidden="true">
          {checked && <Icon name="check" size={14} />}
        </span>
        <span className="platform-tile-text">
          <span className="platform-tile-name">{PLATFORMS[p].name}</span>
          {PLATFORM_NOTE[p] && <span className="platform-tile-note">{PLATFORM_NOTE[p]}</span>}
        </span>
      </label>
    );
  };

  return (
    <div className="step step-start">
      <section className="hero">
        <p className="eyebrow">A free, private self-check</p>
        <h1 tabIndex={-1} data-step-heading>
          Find out what your public profiles&nbsp;reveal.
        </h1>
        <p className="lede">Check your public profiles. See what you share. Clean up what you don't want public.</p>
        <ul className="promise-list" aria-label="How it works">
          <li>
            <Icon name="user" /> No account or email
          </li>
          <li>
            <Icon name="lock" /> Nothing saved — it lives in this tab
          </li>
          <li>
            <Icon name="leaf" /> Free, a few minutes
          </li>
        </ul>
      </section>

      <form className="card form-card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="usernames" className="field-label">
            Your usernames
          </label>
          <p className="field-help" id="usernames-help">
            The handles you use online. Separate with commas or spaces — up to {MAX_USERNAMES}.
          </p>
          <input
            id="usernames"
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="e.g. janedoe, jane.codes"
            value={input.usernamesText}
            aria-describedby={`usernames-help${tooManyUsernames ? ' usernames-limit' : ''}`}
            onChange={(e) => dispatch({ type: 'input', patch: { usernamesText: e.target.value } })}
          />
          {parsed.usernames.length > 0 && (
            <ul className="chip-row" aria-label="Usernames to check">
              {parsed.usernames.slice(0, MAX_USERNAMES).map((u) => (
                <li key={u} className="chip">
                  @{u}
                </li>
              ))}
            </ul>
          )}
          {tooManyUsernames && (
            <p className="field-note" id="usernames-limit">
              <Icon name="info" size={16} /> Only the first {MAX_USERNAMES} will be used. This tool is for checking your own
              handles, one person at a time.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="links" className="field-label">
            Profile links <span className="optional">optional</span>
          </label>
          <p className="field-help" id="links-help">
            Paste links to your own profiles, one per line. Especially useful for Facebook and LinkedIn, where profile addresses
            often differ from usernames.
          </p>
          <textarea
            id="links"
            className="input textarea"
            rows={3}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={'https://www.linkedin.com/in/jane-doe\nhttps://bsky.app/profile/jane.bsky.social'}
            value={input.linksText}
            aria-describedby="links-help"
            onChange={(e) => dispatch({ type: 'input', patch: { linksText: e.target.value } })}
          />
          {linkPreview.length > 0 && (
            <ul className="link-preview" aria-label="Pasted links">
              {linkPreview.map((l, i) =>
                l.ok ? (
                  <li key={i} className="link-preview-ok">
                    <Icon name="check" size={16} />
                    <span>
                      Recognized: {PLATFORMS[l.platform].name} <strong>@{l.handle}</strong>
                    </span>
                  </li>
                ) : (
                  <li key={i} className="link-preview-bad">
                    <Icon name="info" size={16} />
                    <span>
                      <span className="mono">{l.raw.length > 60 ? `${l.raw.slice(0, 57)}…` : l.raw}</span> — {l.reason}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
          {tooManyLinks && (
            <p className="field-note">
              <Icon name="info" size={16} /> Only the first {MAX_LINKS} links will be used.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="display-name" className="field-label">
            Your name as it appears online <span className="optional">optional</span>
          </label>
          <p className="field-help" id="display-name-help">
            Only used to build search shortcuts you can click. It's a search aid, not proof of who you are, and it isn't sent
            anywhere unless you open one of those shortcuts.
          </p>
          <input
            id="display-name"
            className="input"
            type="text"
            autoComplete="off"
            maxLength={MAX_DISPLAY_NAME}
            placeholder="e.g. Jane Doe"
            value={input.displayName}
            aria-describedby="display-name-help"
            onChange={(e) => dispatch({ type: 'input', patch: { displayName: e.target.value } })}
          />
        </div>

        <fieldset className="field platforms">
          <legend className="field-label">Platforms to check</legend>
          <div className="platform-group">
            <p className="platform-group-title">
              <Icon name="check-circle" size={16} /> Checked automatically
            </p>
            <p className="field-help">We ask the platform's public API whether the username exists.</p>
            <div className="platform-grid">{API_PLATFORMS.map(platformTile)}</div>
          </div>
          <div className="platform-group">
            <p className="platform-group-title">
              <Icon name="eye" size={16} /> You review
            </p>
            <p className="field-help">
              These platforms don't offer a free public check, so we give you safe links to open and look at yourself.
            </p>
            <div className="platform-grid">{REVIEW_PLATFORMS.map(platformTile)}</div>
          </div>
        </fieldset>

        <div className="field">
          <Segmented
            legend="What matters most to you? (optional)"
            options={GOALS}
            value={input.goal}
            allowDeselect
            onChange={(goal) => dispatch({ type: 'input', patch: { goal } })}
          />
          <p className="field-help">Used only to order your suggested next steps.</p>
        </div>

        <details className="disclosure">
          <summary>
            <Icon name="shield" size={16} /> What happens when you press the button
          </summary>
          <ul>
            {apiSelected.includes('github') && (
              <li>
                Your usernames are sent from your browser to <span className="mono">api.github.com</span> to ask whether those
                GitHub accounts exist.
              </li>
            )}
            {apiSelected.includes('bluesky') && (
              <li>
                Your handles are sent from your browser to <span className="mono">public.api.bsky.app</span> (Bluesky's public
                API).
              </li>
            )}
            {apiSelected.length > 0 && (
              <li>Like any website, those services can see your IP address. Checking from a browser isn't anonymous.</li>
            )}
            <li>Other platforms aren't contacted. You get links to open yourself, and the platform sees that visit as usual.</li>
            <li>There's no server behind this site, no analytics and no cookies. Your entries stay in this tab's memory.</li>
          </ul>
        </details>

        {error && (
          <p className="form-error" role="alert">
            <Icon name="info" size={16} /> {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-lg">
          Check my footprint <Icon name="arrow-right" />
        </button>
      </form>
    </div>
  );
}
