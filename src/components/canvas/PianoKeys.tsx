'use client';

import { memo, useId, type CSSProperties } from 'react';
import { useSurfaces } from '@/lib/use-surfaces';
import { HIGHLIGHT_PRESETS } from '@/lib/highlight-presets';

/**
 * Piano keyboard SVG in the reference style. Highlighted (chord/scale) and lit
 * (playback) keys take their colour from the --key-highlight / --key-lit
 * tokens, or from a per-element preset (cycled with R). In the Glass surface
 * mode the highlight/lit keys use a local gradient with a faint top-left
 * gloss; the gradient reads the same CSS vars, so the preset flows through.
 */
interface PianoKeysProps {
  baseC: number;
  octaves: number;
  highlighted: ReadonlySet<number>;
  lit?: ReadonlySet<number>;
  /** Highlight-colour preset index (0 = theme default). */
  colorIndex?: number;
}

const WHITE_W = 22;
const WHITE_H = 78;
const BLACK_W = 13.2;
const BLACK_H = 48;
const OCTAVE_W = WHITE_W * 7;

const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMIS = [1, 3, 6, 8, 10];
const BLACK_X: Record<number, number> = {
  1: WHITE_W * 1 - BLACK_W / 2 - 1.5,
  3: WHITE_W * 2 - BLACK_W / 2 + 1.5,
  6: WHITE_W * 4 - BLACK_W / 2 - 1.5,
  8: WHITE_W * 5 - BLACK_W / 2,
  10: WHITE_W * 6 - BLACK_W / 2 + 1.5,
};

export const PianoKeys = memo(function PianoKeys({
  baseC,
  octaves,
  highlighted,
  lit,
  colorIndex = 0,
}: PianoKeysProps) {
  const surfaces = useSurfaces();
  const uid = useId().replace(/[:]/g, '');
  const hiId = `phi${uid}`;
  const litId = `plit${uid}`;
  const glass = surfaces === 'glass';

  const whites: { x: number; pitch: number }[] = [];
  const blacks: { x: number; pitch: number }[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    const octX = oct * OCTAVE_W;
    const octBase = baseC + oct * 12;
    WHITE_SEMIS.forEach((semi, i) => whites.push({ x: octX + i * WHITE_W, pitch: octBase + semi }));
    BLACK_SEMIS.forEach((semi) => blacks.push({ x: octX + BLACK_X[semi], pitch: octBase + semi }));
  }

  const width = octaves * OCTAVE_W;
  const fillFor = (pitch: number, isBlack: boolean) => {
    if (lit?.has(pitch)) return glass ? `url(#${litId})` : 'var(--key-lit)';
    if (highlighted.has(pitch)) return glass ? `url(#${hiId})` : 'var(--key-highlight)';
    return isBlack ? 'var(--key-black)' : 'var(--key-white)';
  };

  // A preset overrides the colour tokens locally; index 0 keeps the theme's.
  const preset = HIGHLIGHT_PRESETS[colorIndex] ?? null;
  const svgStyle = preset
    ? ({ '--key-highlight': preset.hi, '--key-lit': preset.lit } as CSSProperties)
    : undefined;

  return (
    <svg
      viewBox={`0 0 ${width} ${WHITE_H}`}
      width="100%"
      role="img"
      aria-label="Piano keyboard"
      style={{ display: 'block', ...svgStyle }}
    >
      {glass && (
        <defs>
          <linearGradient id={hiId} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--key-highlight) 80%, #fff)' }} />
            <stop offset="1" style={{ stopColor: 'var(--key-highlight)' }} />
          </linearGradient>
          <linearGradient id={litId} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--key-lit) 80%, #fff)' }} />
            <stop offset="1" style={{ stopColor: 'var(--key-lit)' }} />
          </linearGradient>
        </defs>
      )}
      {whites.map(({ x, pitch }) => (
        <rect
          key={pitch}
          x={x + 0.75}
          y={0}
          width={WHITE_W - 1.5}
          height={WHITE_H}
          rx={2.5}
          fill={fillFor(pitch, false)}
          style={{ transition: 'fill 120ms ease-out' }}
        />
      ))}
      {blacks.map(({ x, pitch }) => (
        <rect
          key={pitch}
          x={x}
          y={-3}
          width={BLACK_W}
          height={BLACK_H}
          rx={2.5}
          fill={fillFor(pitch, true)}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={0.5}
          style={{ transition: 'fill 120ms ease-out' }}
        />
      ))}
    </svg>
  );
});
