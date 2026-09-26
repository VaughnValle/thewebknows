import { PLATFORM_ORDER, type PlatformId } from '../lib/types';

const SHORT: Record<PlatformId, string> = {
  github: 'GitHub',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
};

// Hand-placed so labels never collide; slightly irregular so it reads as a web, not a clock face.
const RADII = [150, 128, 158, 136, 152, 126, 160, 134];

/**
 * Decorative "you at the center of your web" graphic. Selected platforms light up.
 * Purely visual — the real state lives in the form next to it.
 */
export function Constellation({ selected }: { selected: PlatformId[] }) {
  return (
    <svg className="constellation" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <g className="c-ring">
        <circle cx="200" cy="200" r="178" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeDasharray="2 7" />
      </g>
      <circle cx="200" cy="200" r="96" fill="none" stroke="currentColor" strokeOpacity="0.07" />
      {PLATFORM_ORDER.map((id, i) => {
        const angle = (i / PLATFORM_ORDER.length) * Math.PI * 2 - Math.PI / 2 + 0.2;
        const r = RADII[i];
        const x = 200 + Math.cos(angle) * r;
        const y = 200 + Math.sin(angle) * r;
        const len = Math.round(Math.hypot(x - 200, y - 200));
        const on = selected.includes(id);
        const labelBelow = y > 200;
        return (
          <g
            key={id}
            className={`c-node${on ? ' is-on' : ''}`}
            style={{ ['--i' as string]: i, ['--len' as string]: len }}
          >
            <line className="c-line" x1="200" y1="200" x2={x} y2={y} />
            <g
              className="c-float"
              style={{
                ['--fx' as string]: `${((i % 3) - 1) * 3}px`,
                ['--fy' as string]: `${i % 2 ? 5 : -5}px`,
                ['--dur' as string]: `${6 + (i % 4)}s`,
              }}
            >
              <circle className="c-dot" cx={x} cy={y} r={on ? 7 : 5.5} />
              <text className="c-label" x={x} y={labelBelow ? y + 24 : y - 16} textAnchor="middle">
                {SHORT[id]}
              </text>
            </g>
          </g>
        );
      })}
      <circle className="c-pulse" cx="200" cy="200" r="26" />
      <circle className="c-pulse c-pulse-2" cx="200" cy="200" r="26" />
      <circle className="c-core" cx="200" cy="200" r="30" />
      <text className="c-core-label" x="200" y="204.5" textAnchor="middle">
        YOU
      </text>
    </svg>
  );
}
