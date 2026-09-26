import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light/dark switch. Starts from the device setting and keeps the choice in
 * memory only (nothing is written to the browser), so a reload follows the device again.
 */
export function ThemeToggle() {
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme = chosen ?? system;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (chosen) root.dataset.theme = chosen;
    else delete root.dataset.theme;
    // Keep the browser UI (address bar on phones) in step with the page.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = theme === 'dark' ? '#000000' : '#ffffff';
    });
  }, [chosen, theme]);

  const toggle = () => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    setChosen(theme === 'dark' ? 'light' : 'dark');
    window.setTimeout(() => root.classList.remove('theme-switching'), 400);
  };

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon key={theme} name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  );
}
