import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789@#%&*';

function reduceMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Text that "decodes" from random characters into its real value, left to right.
 * Re-runs whenever the text changes. Screen readers only get the final text.
 */
export function ScrambleText({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? text : text.replace(/\S/g, '·')));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduceMotion()) {
      setShown(text);
      return;
    }
    let frame = -Math.round(delay / 40);
    const step = text.length > 18 ? 0.8 : 1.2;
    const total = 6 + Math.min(text.length, 32) * step;
    timer.current = setInterval(() => {
      frame++;
      if (frame < 0) return;
      setShown(
        text
          .split('')
          .map((ch, i) => (/\s|[.,:()]/.test(ch) || frame > 4 + i * step ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(''),
      );
      if (frame > total && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        setShown(text);
      }
    }, 40);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [text, delay]);

  return (
    <span className={className}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
