import { useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ReviewStep } from './components/ReviewStep';
import { StartStep } from './components/StartStep';
import { SummaryStep } from './components/SummaryStep';
import { useSession } from './session/SessionContext';

export function App() {
  const { state } = useSession();
  const first = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
  }, [state.step]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <div className="page">
        <main id="main" tabIndex={-1} key={state.step}>
          {state.step === 'start' && <StartStep />}
          {state.step === 'review' && <ReviewStep />}
          {state.step === 'summary' && <SummaryStep />}
        </main>
      </div>
      <footer className="site-footer">
        <p>
          <strong>The Web Knows Me</strong> — a free self-check for your own public profiles.
        </p>
        <p>No accounts · no cookies · no analytics · no server. We never change anything on other sites.</p>
      </footer>
    </>
  );
}
