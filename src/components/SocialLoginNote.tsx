
/**
 * Honest explainer, not a live probe. Detecting your logged-in accounts means a
 * page reaching into your sessions on other services. This site never does that,
 * so we explain the risk instead of demonstrating it on you.
 */
export function SocialLoginNote() {
  return (
    <div className="demo-note">
      <p className="report-blurb">We won’t test this one on you, and here’s why it matters.</p>
      <div className="demo-prose">
        <p>
          A page can try to work out whether you’re signed in to Google, Facebook, and others by quietly loading their resources and
          watching how they respond. Trackers use this to tie your visit to a real identity, and some have combined it with hidden
          buttons to make you reveal who you are with a single click.
        </p>
        <p>
          Doing that means a site reaching into your live sessions on other companies. This site only ever looks at data that’s
          already public and never touches your accounts, so we describe the risk rather than run it against you.
        </p>
        <p className="demo-fixes">
          <strong>How to limit it:</strong> sign out of accounts you aren’t using, block third-party cookies, and use a browser that
          isolates sites from each other, such as Brave, Firefox or Safari.
        </p>
      </div>
    </div>
  );
}
