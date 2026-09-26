import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { SessionProvider } from '../src/session/SessionContext';
import { CheckService } from '../src/lib/checks';
import { githubUser, rateLimitHeaders } from './fixtures/github';
import { blueskyNotFound } from './fixtures/bluesky';
import { deps, scriptedFetch, type Reply } from './fixtures/mockFetch';

// jsdom lacks <dialog> methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
};
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

function setup(replies: Reply[]) {
  const f = scriptedFetch(replies);
  const service = () => new CheckService(deps(f.fetch, Date.now()));
  const user = userEvent.setup();
  render(
    <SessionProvider createService={service}>
      <App />
    </SessionProvider>,
  );
  return { user, f };
}

describe('end-to-end flow (mocked APIs)', () => {
  it('checks, reviews one card at a time, confirms, summarizes and clears', async () => {
    const { user, f } = setup([
      { status: 200, body: { ...githubUser, login: 'janedoe' } }, // GitHub
      { status: 400, body: blueskyNotFound }, // Bluesky
    ]);

    await user.type(screen.getByLabelText('Your usernames'), 'janedoe');
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));
    expect(await screen.findByRole('heading', { name: /which of these/i })).toBeInTheDocument();

    // Only the front card is exposed; GitHub comes first.
    const gh = await screen.findByRole('article', { name: /GitHub: @janedoe/ });
    await within(gh).findByText('API-confirmed');
    expect(screen.getAllByRole('article')).toHaveLength(1);

    // Bluesky "not found" drops out of the deck and is listed separately.
    expect(await screen.findByText(/Not found by API: Bluesky @janedoe\.bsky\.social/)).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /Bluesky/ })).toBeNull();

    // Mine keeps the card on screen with the optional checklist, then Next.
    await user.click(within(gh).getByRole('button', { name: /^Mine/ }));
    expect(within(gh).getByRole('button', { name: /^Mine/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(gh).getByRole('button', { name: /^Next/ }));

    // Instagram is a candidate link, never "found".
    const ig = await screen.findByRole('article', { name: /Instagram: @janedoe/ });
    expect(within(ig).getByText('Open to check', { selector: '.badge span' })).toBeInTheDocument();
    const igLink = within(ig).getByRole('link', { name: /open to check/i });
    expect(igLink).toHaveAttribute('href', 'https://www.instagram.com/janedoe/');
    expect(igLink).toHaveAttribute('rel', 'noopener noreferrer');

    await user.click(within(ig).getByRole('button', { name: /^Mine/ }));
    // Questions come one at a time.
    await user.click(within(within(ig).getByRole('group', { name: /full name/i })).getByRole('radio', { name: /^No$/ }));
    await user.click(within(within(ig).getByRole('group', { name: /school, workplace/i })).getByRole('radio', { name: /Not sure/ }));
    const contactQ = within(ig).getByRole('group', { name: /personal email or phone/i });
    await user.click(within(contactQ).getByRole('radio', { name: /Yes/ }));
    expect(within(ig).getByRole('button', { name: /Email or phone: Yes/ })).toBeInTheDocument();
    await user.click(within(ig).getByRole('button', { name: /^Next/ }));

    // Keyboard: ← is "Not mine" and moves on.
    const tt = await screen.findByRole('article', { name: /TikTok: @janedoe/ });
    expect(tt).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('button', { name: /TikTok @janedoe: Not mine/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /see my summary/i }));
    expect(await screen.findByRole('heading', { name: /take back your footprint/i })).toBeInTheDocument();
    expect(screen.getByText(/profiles confirmed/).textContent).toMatch(/^2 profiles confirmed/);
    // Confirmed profiles are tucked away until asked for.
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /review your confirmed profiles 2/i }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: /remove your personal email or phone number from instagram/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /username reuse/i }).nextElementSibling).toHaveTextContent(/janedoe is yours on GitHub and Instagram/);

    // No danger score or alarming words anywhere.
    expect(document.body.textContent).not.toMatch(/danger|risk score|exposed!|alarming|hacker|attacker/i);

    await user.click(screen.getByRole('button', { name: /^clear session$/i }));
    await user.click(screen.getByRole('button', { name: /clear everything/i }));
    await waitFor(() => expect(screen.getByLabelText('Your usernames')).toHaveValue(''));
    expect(f.calls).toHaveLength(2);
  });

  it('keeps guided mode usable when GitHub is rate-limited', async () => {
    const reset = Math.floor(Date.now() / 1000) + 1800;
    const { user } = setup([{ status: 403, body: { message: 'API rate limit exceeded' }, headers: rateLimitHeaders(reset) }]);
    await user.click(screen.getByRole('checkbox', { name: /bluesky/i })); // untick
    await user.type(screen.getByLabelText('Your usernames'), 'janedoe');
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));

    const gh = await screen.findByRole('article', { name: /GitHub: @janedoe/ });
    await within(gh).findByText('Unable to check right now');
    expect(within(gh).getByText(/isn.t a result either way/i)).toBeInTheDocument();
    expect(within(gh).getByRole('link', { name: /open to check/i })).toHaveAttribute('href', 'https://github.com/janedoe');
    expect(within(gh).getByRole('button', { name: /retry after/i })).toBeDisabled();
    expect(within(gh).getByRole('button', { name: /^Mine/ })).toBeInTheDocument();
  });

  it('shows an end card when every card is reviewed', async () => {
    const { user } = setup([]);
    for (const p of ['github', 'bluesky', 'instagram', 'tiktok', 'x (twitter)', 'facebook', 'linkedin']) {
      await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${p.replace(/[()]/g, '\\$&')}`, 'i') }));
    }
    await user.type(screen.getByLabelText('Your usernames'), 'janedoe');
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));
    const rd = await screen.findByRole('article', { name: /Reddit: @janedoe/ });
    await user.click(within(rd).getByRole('button', { name: /^Unsure/ }));
    expect(await screen.findByRole('heading', { name: /all reviewed/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /go through again/i }));
    expect(await screen.findByRole('article', { name: /Reddit: @janedoe/ })).toBeInTheDocument();
  });

  it('shows a calm empty state when nothing is confirmed', async () => {
    const { user } = setup([]);
    await user.click(screen.getByRole('checkbox', { name: /github/i }));
    await user.click(screen.getByRole('checkbox', { name: /bluesky/i }));
    await user.type(screen.getByLabelText('Your usernames'), 'janedoe');
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));
    await user.click(await screen.findByRole('button', { name: /see my summary/i }));
    expect(screen.getByText(/doesn.t mean you have no footprint/i)).toBeInTheDocument();
  });

  it('asks for input before starting', async () => {
    const { user } = setup([]);
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one username/i);
  });

  it('never writes to localStorage or sessionStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { user } = setup([{ status: 404, body: {} }, { status: 400, body: blueskyNotFound }]);
    await user.type(screen.getByLabelText('Your usernames'), 'janedoe');
    await user.click(screen.getByRole('button', { name: /check my footprint/i }));
    await screen.findByRole('heading', { name: /which of these/i });
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });
});
