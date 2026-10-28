
/**
 * Honest explainer, not a live probe. Detecting your logged-in accounts means a
 * page reaching into your sessions on other services. This site never does that,
 * so we explain the risk instead of demonstrating it on you.
 */
export function SocialLoginNote() {
  return (
    <div className="demo-note">
      <p className="report-blurb">Not run on you. Here’s why it matters.</p>
      <div className="demo-prose">
        <p>
          A page can work out whether you’re signed in to Google, Facebook and others by quietly loading their resources and
          watching how they respond. Trackers use it to tie your visit to a real identity.
        </p>
        <p>
          That means reaching into your live sessions elsewhere. This site never touches your accounts, so you get the
          explanation, not the demo.
        </p>
        <p className="demo-fixes">
          <strong>How to limit it:</strong> sign out of accounts you aren’t using, block third-party cookies, and use a browser that
          isolates sites, like Brave, Firefox or Safari.
        </p>
      </div>
    </div>
  );
}
