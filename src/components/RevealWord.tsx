import { useCallback, useEffect, useRef, useState } from 'react';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz@#%&*?!';

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * "reveal." starts under a redaction bar. The bar slides off and the letters
 * unscramble into place. Hovering (or focusing) replays it. Screen readers get the plain word.
 */
export function RevealWord({ word, delay = 850 }: { word: string; delay?: number }) {
  const [chars, setChars] = useState<string[]>(() => word.split('').map((c) => (c === '.' ? c : '#')));
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const scramble = useCallback(
    (startDelay: number) => {
      if (timer.current) clearInterval(timer.current);
      if (reducedMotion()) {
        setChars(word.split(''));
        return () => {};
      }
      let frame = 0;
      const startFrame = Math.round(startDelay / 45);
      timer.current = setInterval(() => {
        frame++;
        const f = frame - startFrame;
        if (f < 0) return;
        setChars(
          word.split('').map((ch, i) => {
            if (ch === '.' || f > 6 + i * 3) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }),
        );
        if (f > 6 + word.length * 3 && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      }, 45);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    },
    [word],
  );

  useEffect(() => scramble(delay), [scramble, delay]);

  const replay = () => {
    if (timer.current) return; // already running
    setRun((r) => r + 1);
    scramble(220);
  };

  return (
    <em className="reveal" onMouseEnter={replay}>
      <span className="visually-hidden">{word}</span>
      <span className="reveal-size" aria-hidden="true">
        {word}
      </span>
      <span className="reveal-chars" aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className={c === word[i] ? 'is-set' : undefined}>
            {c}
          </span>
        ))}
      </span>
      <span key={run} className={`reveal-bar${run ? ' is-replay' : ''}`} aria-hidden="true" />
    </em>
  );
}
