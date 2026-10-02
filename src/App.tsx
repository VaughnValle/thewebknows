import { useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ReviewStep } from './components/ReviewStep';
import { StartStep } from './components/StartStep';
import { SummaryStep } from './components/SummaryStep';
import { DeviceProvider, type DeviceLoaders } from './session/DeviceContext';
import { useSession } from './session/SessionContext';

export function App({ deviceLoaders }: { deviceLoaders?: DeviceLoaders } = {}) {
  const { state, generation } = useSession();
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
    <DeviceProvider key={generation} loaders={deviceLoaders}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <div className="page">
        <main id="main" tabIndex={-1} key={`${state.step}-${generation}`}>
          {state.step === 'start' && <StartStep />}
          {state.step === 'review' && <ReviewStep />}
          {state.step === 'summary' && <SummaryStep />}
        </main>
      </div>
      <footer className="site-footer">
        <p>
          <strong>The Web Knows Me</strong> · A free self-check for your digital footprint.
        </p>
        <p>No accounts, personal data, cookies or analytics collected.</p>
      </footer>
    </DeviceProvider>
  );
}
